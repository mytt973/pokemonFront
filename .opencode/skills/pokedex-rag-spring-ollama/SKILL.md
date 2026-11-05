---
name: "pokedex-rag-spring-ollama"
description: "Crée un chatbot RAG Pokémon 100 % local avec Spring Boot, Spring AI, Ollama et PokeAPI, plus le composant de chat React. À utiliser pour un RAG PokeAPI ou un chatbot local Spring."
---

# Chatbot RAG Pokémon 100 % local (Spring Boot + Spring AI + Ollama)

Ce skill crée le backend d'un chatbot qui répond uniquement sur les Pokémon, à partir des données de PokeAPI, sans clé API ni coût. Le front est un site React que la personne a déjà. Le code ci-dessous n'a pas pu être compilé au moment de la rédaction du skill : voir la section « Si la compilation échoue ».

## Décisions déjà prises avec l'utilisateur

- Backend : Java 21, Spring Boot 3.5.x, Spring AI 1.1.x. Front : React existant, il appelle le backend en HTTP.
- 100 % local et gratuit : Ollama installé directement sur la machine (Windows). Pas de Docker.
- Base vectorielle : `SimpleVectorStore` de Spring AI, sauvegardé dans un fichier JSON (suffisant pour ~1000 fiches). SQLite n'est pas pris en charge par Spring AI : si la personne veut une vraie base, proposer PostgreSQL + pgvector (`PgVectorStore`). Le code utilise déjà des UUID déterministes pour faciliter ce passage.
- Modèle d'embeddings : `bge-m3` (multilingue, 8192 tokens, ~1,2 Go). Plus léger : `nomic-embed-text-v2-moe` (~500 Mo, multilingue, 512 tokens max : vérifier les préfixes recommandés par ce modèle).
- Modèle de chat par défaut : `qwen2.5:3b`, petit, multilingue et sans mode « réflexion ». Qwen3 produit un raisonnement avant la réponse qu'il faut désactiver pour un chatbot, d'où ce choix par défaut.
- Les données viennent de PokeAPI (gratuite, sans clé, politique d'usage raisonnable) : cache disque obligatoire et petite pause entre les appels non mis en cache.

## Avant de commencer

Poser au plus une ou deux questions si l'information manque :

1. Combien de VRAM sur la carte graphique (`nvidia-smi` dans PowerShell, colonne mémoire) ? Une RTX 3050 Laptop a 4 Go (version d'origine) ou 6 Go (refresh 2023).
2. Quel nom de package Java et quel outil front (Vite ou Create React App) ?

Choix du modèle de chat selon la VRAM (Q4, contexte 8K) :

| VRAM | Modèle de chat | Remarque |
|---|---|---|
| 4 Go | `qwen2.5:3b` (~2 Go) ou `qwen3:4b` (2,5 Go) | `gemma3:4b` (3,3 Go) déborde sur le CPU, donc plus lent |
| 6 Go | `gemma3:4b` ou `qwen3:4b` | les modèles 7-8B demandent ~6-7 Go, trop juste |
| 8 Go et plus | `qwen3:8b` ou `gemma3:12b` selon la VRAM | vérifier les tailles sur ollama.com/library |

Avec 4 Go, le modèle de chat plus `bge-m3` peuvent dépasser la VRAM : Ollama charge et décharge les modèles, ce qui ajoute de la latence. Si c'est gênant, passer au modèle d'embeddings plus léger.

## Prérequis sur la machine

```powershell
ollama pull bge-m3
ollama pull qwen2.5:3b
```

Ollama écoute sur `http://localhost:11434`. Par défaut il décharge les modèles après 5 minutes d'inactivité : la première question après une pause est plus lente (réglable avec la variable `OLLAMA_KEEP_ALIVE`). Java 21 et Maven (ou le wrapper) sont requis.

## Architecture

- Ingestion (une seule fois, tâche de fond) : PokeAPI (`/pokemon-species`, `/pokemon`, `/type`) -> une fiche texte en français par Pokémon -> embeddings via Ollama -> fichier `data/pokemon-vectors.json`.
- Question : React -> `POST /api/chat` -> le backend vectorise la question, récupère les 3 fiches les plus proches, puis interroge le modèle de chat avec la consigne de ne répondre qu'à partir de ces fiches.
- Les descriptions du Pokédex sont dans `/pokemon-species/{id}` (`flavor_text_entries`). Elles contiennent des sauts de ligne et des doublons d'un jeu à l'autre : le code nettoie, dédoublonne, garde 3 textes français (ou 2 anglais en repli, signalé comme tel). Les stats, types et talents viennent de `/pokemon/{id}`.

## Arborescence à créer

```
pokedex-rag/
├── pom.xml
├── .gitignore                (target/ et data/)
└── src/main/
    ├── resources/application.yml
    └── java/<package>/
        ├── PokedexRagApplication.java
        ├── config/VectorStoreConfig.java
        ├── ingest/PokeApiClient.java
        ├── ingest/IngestionService.java
        └── web/ChatController.java, IngestController.java
```

Le code ci-dessous utilise le package `com.example.pokedexrag` : le remplacer par celui de la personne dans les fichiers et dans les `import`.

### pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.5.6</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>pokedex-rag</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>pokedex-rag</name>
    <description>Chatbot RAG Pokémon 100 % local (Spring AI + Ollama + PokeAPI)</description>

    <properties>
        <java.version>21</java.version>
        <spring-ai.version>1.1.2</spring-ai.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.ai</groupId>
            <artifactId>spring-ai-starter-model-ollama</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.ai</groupId>
            <artifactId>spring-ai-vector-store</artifactId>
        </dependency>
    </dependencies>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.ai</groupId>
                <artifactId>spring-ai-bom</artifactId>
                <version>${spring-ai.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

Si les versions sont dépassées, prendre la dernière version stable de Spring Boot 3.5.x et de Spring AI 1.1.x (par exemple via start.spring.io) et ne changer que ces deux numéros.

### src/main/resources/application.yml

```yaml
server:
  port: 8080

spring:
  application:
    name: pokedex-rag
  ai:
    ollama:
      base-url: ${OLLAMA_URL:http://localhost:11434}
      chat:
        options:
          # Modèle léger qui tient dans 4 Go de VRAM et ne "réfléchit" pas à voix haute.
          model: ${CHAT_MODEL:qwen2.5:3b}
          temperature: 0.2
          num-ctx: 4096
      embedding:
        options:
          model: ${EMBEDDING_MODEL:bge-m3}

pokedex:
  # Contient le cache PokeAPI et le fichier de vecteurs (pokemon-vectors.json)
  data-dir: ${DATA_DIR:./data}
  ingest:
    # 0 = tous les Pokémon. Mets 151 pour tester vite (1re génération).
    limit: ${INGEST_LIMIT:0}
    # Pause entre deux appels PokeAPI non mis en cache (politesse / fair use)
    delay-ms: 100
  rag:
    # Nombre de fiches injectées dans le prompt (3 = bon compromis pour un petit modèle)
    top-k: 3
```

### PokedexRagApplication.java

```java
package com.example.pokedexrag;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class PokedexRagApplication {

    public static void main(String[] args) {
        SpringApplication.run(PokedexRagApplication.class, args);
    }
}
```

### config/VectorStoreConfig.java

```java
package com.example.pokedexrag.config;

import java.io.File;
import java.nio.file.Path;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Base vectorielle "maison" : tout est en mémoire, et sauvegardé dans un fichier JSON.
 * Pour passer à pgvector plus tard, il suffira de remplacer ce bean.
 */
@Configuration
public class VectorStoreConfig {

    private static final Logger log = LoggerFactory.getLogger(VectorStoreConfig.class);

    public static final String VECTORS_FILE = "pokemon-vectors.json";

    @Bean
    public SimpleVectorStore vectorStore(EmbeddingModel embeddingModel,
                                         @Value("${pokedex.data-dir}") String dataDir) {
        SimpleVectorStore store = SimpleVectorStore.builder(embeddingModel).build();
        File file = Path.of(dataDir, VECTORS_FILE).toFile();
        if (file.exists()) {
            try {
                store.load(file);
                log.info("Base vectorielle chargée depuis {}", file.getAbsolutePath());
            } catch (Exception e) {
                log.warn("Impossible de lire {} ({}). Relance l'ingestion.", file, e.getMessage());
            }
        } else {
            log.info("Aucune base vectorielle trouvée ({}). Lance POST /api/admin/ingest.", file);
        }
        return store;
    }
}
```

### ingest/PokeApiClient.java

```java
package com.example.pokedexrag.ingest;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Client PokeAPI avec cache disque : chaque URL n'est téléchargée qu'une seule fois.
 * PokeAPI est gratuite mais soumise à une politique d'usage raisonnable : on met en cache et on espace les appels.
 */
@Component
public class PokeApiClient {

    private static final String BASE = "https://pokeapi.co/api/v2/";

    private final RestClient rest = RestClient.builder()
            .defaultHeader("User-Agent", "pokedex-rag-demo")
            .build();
    private final ObjectMapper mapper;
    private final Path cacheDir;
    private final long delayMs;

    public PokeApiClient(ObjectMapper mapper,
                         @Value("${pokedex.data-dir}") String dataDir,
                         @Value("${pokedex.ingest.delay-ms}") long delayMs) {
        this.mapper = mapper;
        this.cacheDir = Path.of(dataDir, "cache");
        this.delayMs = delayMs;
    }

    /** Exemple : get("pokemon-species/25") ou get("pokemon-species?limit=2000"). */
    public JsonNode get(String path) {
        Path file = cacheDir.resolve(path.replaceAll("[^a-zA-Z0-9._-]", "_") + ".json");
        try {
            if (Files.exists(file)) {
                return mapper.readTree(file.toFile());
            }
            String body = rest.get().uri(URI.create(BASE + path)).retrieve().body(String.class);
            Files.createDirectories(cacheDir);
            Files.writeString(file, body);
            Thread.sleep(delayMs);
            return mapper.readTree(body);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Ingestion interrompue", e);
        }
    }

    /** Accepte les URL absolues renvoyées par PokeAPI (ex. https://pokeapi.co/api/v2/pokemon/25/). */
    public JsonNode getByUrl(String url) {
        String path = url.startsWith(BASE) ? url.substring(BASE.length()) : url;
        if (path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return get(path);
    }
}
```

### ingest/IngestionService.java

```java
package com.example.pokedexrag.ingest;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import com.example.pokedexrag.config.VectorStoreConfig;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Ingestion : PokeAPI -> une fiche texte (en français) par Pokémon -> embeddings (Ollama) -> fichier JSON.
 * Tourne en tâche de fond : on suit l'avancement avec status().
 */
@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);

    private static final Map<String, String> STAT_FR = Map.of(
            "hp", "PV",
            "attack", "Attaque",
            "defense", "Défense",
            "special-attack", "Attaque spéciale",
            "special-defense", "Défense spéciale",
            "speed", "Vitesse");

    private static final int BATCH_SIZE = 25;

    private final PokeApiClient api;
    private final SimpleVectorStore store;
    private final Path vectorsFile;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicReference<String> status = new AtomicReference<>("inactif");

    public IngestionService(PokeApiClient api,
                            SimpleVectorStore store,
                            @Value("${pokedex.data-dir}") String dataDir) {
        this.api = api;
        this.store = store;
        this.vectorsFile = Path.of(dataDir, VectorStoreConfig.VECTORS_FILE);
    }

    /** @return false si une ingestion est déjà en cours. */
    public boolean start(int limit) {
        if (!running.compareAndSet(false, true)) {
            return false;
        }
        CompletableFuture.runAsync(() -> {
            try {
                run(limit);
            } catch (Exception e) {
                log.error("Échec de l'ingestion", e);
                status.set("erreur : " + e.getMessage());
            } finally {
                running.set(false);
            }
        });
        return true;
    }

    public String status() {
        return status.get();
    }

    private void run(int limit) throws Exception {
        // 1. Liste des espèces
        List<String> urls = new ArrayList<>();
        api.get("pokemon-species?limit=2000").path("results")
                .forEach(n -> urls.add(n.path("url").asText()));
        List<String> selected = (limit > 0 && limit < urls.size()) ? urls.subList(0, limit) : urls;

        // 2. Noms des types en français (une vingtaine d'appels)
        Map<String, String> typesFr = new HashMap<>();
        for (JsonNode t : api.get("type?limit=100").path("results")) {
            JsonNode type = api.getByUrl(t.path("url").asText());
            String slug = type.path("name").asText();
            typesFr.put(slug, localized(type.path("names"), "name", "fr").orElse(capitalize(slug)));
        }

        // 3. Espèces (descriptions, noms, évolutions)
        Map<String, JsonNode> speciesBySlug = new LinkedHashMap<>();
        int i = 0;
        for (String url : selected) {
            status.set("PokeAPI : espèce " + (++i) + "/" + selected.size());
            JsonNode s = api.getByUrl(url);
            speciesBySlug.put(s.path("name").asText(), s);
        }
        Map<String, List<String>> evolvesInto = new HashMap<>();
        for (JsonNode s : speciesBySlug.values()) {
            String from = s.path("evolves_from_species").path("name").asText(null);
            if (from != null) {
                evolvesInto.computeIfAbsent(from, k -> new ArrayList<>()).add(s.path("name").asText());
            }
        }

        // 4. Pokémon (stats, types, talents) puis fiches texte
        List<Document> docs = new ArrayList<>();
        int j = 0;
        for (JsonNode s : speciesBySlug.values()) {
            status.set("PokeAPI : fiche " + (++j) + "/" + speciesBySlug.size());
            JsonNode pokemon = api.getByUrl(defaultPokemonUrl(s));
            docs.add(toDocument(s, pokemon, typesFr, speciesBySlug, evolvesInto));
        }

        // 5. Embeddings par lots (Ollama) puis sauvegarde du fichier JSON
        for (int from = 0; from < docs.size(); from += BATCH_SIZE) {
            int to = Math.min(from + BATCH_SIZE, docs.size());
            store.add(new ArrayList<>(docs.subList(from, to)));
            status.set("Vectorisation : " + to + "/" + docs.size());
        }
        Files.createDirectories(vectorsFile.getParent());
        File file = vectorsFile.toFile();
        store.save(file);
        status.set("terminé : " + docs.size() + " fiches indexées");
        log.info("Ingestion terminée : {} fiches -> {}", docs.size(), file.getAbsolutePath());
    }

    private static String defaultPokemonUrl(JsonNode species) {
        for (JsonNode v : species.path("varieties")) {
            if (v.path("is_default").asBoolean()) {
                return v.path("pokemon").path("url").asText();
            }
        }
        throw new IllegalStateException("Pas de variété par défaut pour " + species.path("name").asText());
    }

    private Document toDocument(JsonNode s, JsonNode p,
                                Map<String, String> typesFr,
                                Map<String, JsonNode> speciesBySlug,
                                Map<String, List<String>> evolvesInto) {
        int id = s.path("id").asInt();
        String slug = s.path("name").asText();
        String nameFr = displayName(s, slug);
        String nameEn = localized(s.path("names"), "name", "en").orElse(capitalize(slug));
        String genus = localized(s.path("genera"), "genus", "fr")
                .or(() -> localized(s.path("genera"), "genus", "en"))
                .orElse("");

        List<String> types = new ArrayList<>();
        for (JsonNode t : p.path("types")) {
            String tn = t.path("type").path("name").asText();
            types.add(typesFr.getOrDefault(tn, tn));
        }
        List<String> abilities = new ArrayList<>();
        for (JsonNode a : p.path("abilities")) {
            String an = a.path("ability").path("name").asText().replace('-', ' ');
            abilities.add(a.path("is_hidden").asBoolean() ? an + " (talent caché)" : an);
        }
        List<String> stats = new ArrayList<>();
        for (JsonNode st : p.path("stats")) {
            String sn = st.path("stat").path("name").asText();
            stats.add(STAT_FR.getOrDefault(sn, sn) + " " + st.path("base_stat").asInt());
        }

        StringBuilder t = new StringBuilder(nameFr);
        if (!genus.isBlank()) {
            t.append(" (").append(genus).append(")");
        }
        t.append(". Numéro ").append(id).append(" du Pokédex.");
        if (!nameFr.equalsIgnoreCase(nameEn)) {
            t.append(" Nom anglais : ").append(nameEn).append(".");
        }
        t.append(" Type : ").append(String.join(" / ", types)).append(".");
        if (!abilities.isEmpty()) {
            t.append(" Talents : ").append(String.join(", ", abilities)).append(".");
        }
        t.append(" Taille : ").append(fmt(p.path("height").asInt() / 10.0)).append(" m.")
                .append(" Poids : ").append(fmt(p.path("weight").asInt() / 10.0)).append(" kg.");
        t.append(" Statistiques de base : ").append(String.join(", ", stats)).append(".");

        String from = s.path("evolves_from_species").path("name").asText(null);
        if (from != null) {
            t.append(" Évolue depuis : ").append(nameBySlug(from, speciesBySlug)).append(".");
        }
        List<String> into = new ArrayList<>();
        for (String childSlug : evolvesInto.getOrDefault(slug, List.of())) {
            into.add(nameBySlug(childSlug, speciesBySlug));
        }
        if (!into.isEmpty()) {
            t.append(" Évolue en : ").append(String.join(", ", into)).append(".");
        }
        if (s.path("is_legendary").asBoolean()) {
            t.append(" C'est un Pokémon légendaire.");
        }
        if (s.path("is_mythical").asBoolean()) {
            t.append(" C'est un Pokémon fabuleux.");
        }

        boolean french = true;
        List<String> flavors = flavors(s.path("flavor_text_entries"), "fr", 3);
        if (flavors.isEmpty()) {
            french = false;
            flavors = flavors(s.path("flavor_text_entries"), "en", 2);
        }
        if (!flavors.isEmpty()) {
            t.append(" Description du Pokédex").append(french ? "" : " (en anglais)").append(" : ")
                    .append(String.join(" ", flavors));
        }

        // UUID déterministe : relancer l'ingestion remplace les fiches au lieu de les dupliquer
        // (et c'est le format exigé si on passe plus tard à pgvector).
        String uuid = UUID.nameUUIDFromBytes(("pokemon-" + id).getBytes(StandardCharsets.UTF_8)).toString();
        return Document.builder()
                .id(uuid)
                .text(t.toString())
                .metadata("pokemonId", id)
                .metadata("name", nameFr)
                .build();
    }

    /** Descriptions du Pokédex : textes distincts, nettoyés des sauts de ligne des anciens jeux. */
    private static List<String> flavors(JsonNode entries, String lang, int max) {
        Map<String, String> seen = new LinkedHashMap<>();
        for (JsonNode e : entries) {
            if (!lang.equals(e.path("language").path("name").asText())) {
                continue;
            }
            String text = e.path("flavor_text").asText()
                    .replaceAll("\\u00ad", "")
                    .replaceAll("[\\n\\f\\r]+", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
            seen.putIfAbsent(text.toLowerCase(Locale.ROOT), text);
            if (seen.size() >= max) {
                break;
            }
        }
        return new ArrayList<>(seen.values());
    }

    private static Optional<String> localized(JsonNode array, String valueField, String lang) {
        for (JsonNode e : array) {
            if (lang.equals(e.path("language").path("name").asText())) {
                return Optional.of(e.path(valueField).asText());
            }
        }
        return Optional.empty();
    }

    private static String displayName(JsonNode species, String slug) {
        return localized(species.path("names"), "name", "fr")
                .or(() -> localized(species.path("names"), "name", "en"))
                .orElse(capitalize(slug));
    }

    private static String nameBySlug(String slug, Map<String, JsonNode> speciesBySlug) {
        JsonNode s = speciesBySlug.get(slug);
        return s != null ? displayName(s, slug) : capitalize(slug);
    }

    private static String capitalize(String slug) {
        String s = slug.replace('-', ' ');
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String fmt(double v) {
        return String.format(Locale.FRANCE, "%.1f", v);
    }
}
```

### web/ChatController.java

```java
package com.example.pokedexrag.web;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class ChatController {

    public record ChatRequest(String question) {}

    public record Source(String name) {}

    public record ChatResponse(String answer, List<Source> sources) {}

    private static final String SYSTEM = """
            Tu es un assistant Pokédex. Réponds toujours en français, de façon courte et claire.
            Tu réponds UNIQUEMENT à partir des fiches fournies dans le CONTEXTE.
            Si l'information n'est pas dans le contexte, dis que tu ne la trouves pas dans ta base.
            Si la question ne concerne pas les Pokémon, refuse poliment.
            N'invente aucun chiffre, aucun talent et aucune évolution.
            """;

    private static final String USER_TEMPLATE = """
            CONTEXTE :
            {context}

            QUESTION : {question}
            """;

    private static final String EMPTY_BASE =
            "Ma base est vide : lance d'abord l'ingestion (POST /api/admin/ingest).";

    private final ChatClient chatClient;
    private final VectorStore vectorStore;
    private final int topK;

    public ChatController(ChatClient.Builder chatClientBuilder,
                          VectorStore vectorStore,
                          @Value("${pokedex.rag.top-k}") int topK) {
        this.chatClient = chatClientBuilder.build();
        this.vectorStore = vectorStore;
        this.topK = topK;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest request) {
        String question = validate(request);
        List<Document> docs = retrieve(question);
        if (docs.isEmpty()) {
            return new ChatResponse(EMPTY_BASE, List.of());
        }
        String answer = chatClient.prompt()
                .system(SYSTEM)
                .user(u -> u.text(USER_TEMPLATE).param("context", context(docs)).param("question", question))
                .call()
                .content();
        return new ChatResponse(answer, sources(docs));
    }

    /** Même chose, mais la réponse arrive morceau par morceau (utile avec un petit modèle un peu lent). */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> stream(@RequestBody ChatRequest request) {
        String question = validate(request);
        List<Document> docs = retrieve(question);
        if (docs.isEmpty()) {
            return Flux.just(EMPTY_BASE);
        }
        return chatClient.prompt()
                .system(SYSTEM)
                .user(u -> u.text(USER_TEMPLATE).param("context", context(docs)).param("question", question))
                .stream()
                .content();
    }

    private List<Document> retrieve(String question) {
        return vectorStore.similaritySearch(SearchRequest.builder().query(question).topK(topK).build());
    }

    private static String context(List<Document> docs) {
        return docs.stream().map(Document::getText).collect(Collectors.joining("\n---\n"));
    }

    private static List<Source> sources(List<Document> docs) {
        return docs.stream()
                .map(d -> new Source(String.valueOf(d.getMetadata().get("name"))))
                .toList();
    }

    private static String validate(ChatRequest request) {
        if (request == null || request.question() == null || request.question().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La question est vide.");
        }
        return request.question().trim();
    }
}
```

### web/IngestController.java

```java
package com.example.pokedexrag.web;

import java.util.Map;

import com.example.pokedexrag.ingest.IngestionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints d'administration, à usage local uniquement (aucune authentification). */
@RestController
@RequestMapping("/api/admin")
public class IngestController {

    private final IngestionService ingestion;
    private final int defaultLimit;

    public IngestController(IngestionService ingestion,
                            @Value("${pokedex.ingest.limit}") int defaultLimit) {
        this.ingestion = ingestion;
        this.defaultLimit = defaultLimit;
    }

    @PostMapping("/ingest")
    public ResponseEntity<Map<String, String>> start(@RequestParam(required = false) Integer limit) {
        int effective = limit != null ? limit : defaultLimit;
        if (ingestion.start(effective)) {
            return ResponseEntity.accepted().body(Map.of("status", "démarré"));
        }
        return ResponseEntity.status(409).body(Map.of("status", "ingestion déjà en cours"));
    }

    @GetMapping("/ingest/status")
    public Map<String, String> status() {
        return Map.of("status", ingestion.status());
    }
}
```

## Lancer et tester (PowerShell)

```powershell
mvn spring-boot:run

# Test rapide : 151 Pokémon (1re génération), environ quelques minutes la première fois
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/admin/ingest?limit=151"
Invoke-RestMethod -Uri "http://localhost:8080/api/admin/ingest/status"

# Quand le statut dit « terminé »
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/chat -ContentType "application/json" -Body '{"question":"Quel est le type de Pikachu ?"}'
```

L'ingestion est une tâche de fond : le premier appel répond tout de suite, et `status` donne l'avancement. Les réponses de PokeAPI sont mises en cache dans `data/cache`, donc relancer est rapide. Le fichier `data/pokemon-vectors.json` est rechargé au démarrage. Sans `limit`, tous les Pokémon sont indexés.

## Composant React

Adapter la variable d'environnement à l'outil front : `import.meta.env.VITE_API_URL` avec Vite, `process.env.REACT_APP_API_URL` avec Create React App. Le backend autorise les origines `http://localhost:5173` (Vite) et `http://localhost:3000` : ajuster `@CrossOrigin` sinon.

```jsx
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export default function PokedexChat() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Pose-moi une question sur les Pokémon !" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: data.answer, sources: data.sources }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "bot", text: "Le serveur ne répond pas. Ollama et le backend sont-ils lancés ?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="pokedex-chat">
      <ul>
        {messages.map((m, i) => (
          <li key={i} className={`msg msg-${m.role}`}>
            <p>{m.text}</p>
            {m.sources?.length > 0 && (
              <small>Sources : {m.sources.map((s) => s.name).join(", ")}</small>
            )}
          </li>
        ))}
        {loading && (
          <li className="msg msg-bot">
            <p>…</p>
          </li>
        )}
      </ul>
      <form onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex. : Quelles sont les évolutions d'Évoli ?"
        />
        <button type="submit" disabled={loading}>Envoyer</button>
      </form>
    </section>
  );
}
```

Avec un petit modèle sur 4 Go, une réponse peut prendre plusieurs secondes. L'endpoint `POST /api/chat/stream` renvoie la réponse en flux (lecture avec `fetch` et `response.body.getReader()`, car `EventSource` ne gère que GET).

## Si la compilation échoue

Le code a été écrit sans pouvoir être compilé (Maven Central inaccessible depuis l'environnement de rédaction). Les API de Spring AI évoluent d'une version à l'autre. Vérifier en priorité, dans cet ordre :

1. `SimpleVectorStore.builder(embeddingModel).build()` et les méthodes `save(File)` / `load(File)`.
2. `Document.builder().id(...).text(...).metadata(clé, valeur).build()` et `Document.getText()`.
3. `SearchRequest.builder().query(...).topK(...).build()`.
4. `chatClient.prompt().system(...).user(u -> u.text(...).param(...))`.
5. Les noms de propriétés `spring.ai.ollama.chat.options.num-ctx` et `spring.ai.ollama.embedding.options.model`.
6. Les numéros de version de Spring Boot et de Spring AI dans le `pom.xml`.

En cas de doute, consulter la documentation officielle de Spring AI correspondant à la version utilisée.

## Pièges connus

- Ollama doit tourner avant de lancer l'ingestion et le chat. Si le modèle n'est pas téléchargé, `ollama pull <modèle>`.
- Changer de modèle d'embeddings oblige à tout réindexer : supprimer `data/pokemon-vectors.json` et relancer l'ingestion.
- Le modèle de chat ne doit jamais recevoir plus de 3 fiches avec un petit modèle : il perd le fil et ignore la consigne de ne répondre qu'à partir du contexte.
- Ne pas commiter `data/` (cache PokeAPI et vecteurs) : l'ajouter au `.gitignore`.
- Les endpoints `/api/admin/*` n'ont pas d'authentification : ne pas les exposer hors de la machine locale.
- Pour héberger le site en ligne, Ollama devrait aussi tourner sur un serveur avec assez de mémoire : ce n'est plus gratuit. Le modèle est isolé dans un seul endroit (le `ChatClient`), donc le remplacer plus tard par une API est possible sans tout refaire.