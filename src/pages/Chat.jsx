import { useEffect, useRef, useState } from "react"
import "./Chat.css"

// En Vite, import.meta.env contient les variables des fichiers .env
// dont le nom commence par VITE_ (ex. VITE_API_URL=http://localhost:8080).
// Sans fichier .env, on retombe sur le backend local.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080"

const WELCOME = "Pose-moi une question sur les Pokémon. Je réponds uniquement à partir des fiches PokeAPI indexées."

const SUGGESTIONS = [
    "Quel est le type de Pikachu ?",
    "Quelles sont les évolutions d'Évoli ?",
    "Quels sont les points forts de Dracaufeu ?",
    "Quels Pokémon sont légendaires dans la première génération ?",
]

function Chat() {
    const [messages, setMessages] = useState([{ role: "bot", text: WELCOME, sources: [] }])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const messagesRef = useRef(null)

    useEffect(() => {
        const container = messagesRef.current
        if (container) container.scrollTop = container.scrollHeight
    }, [messages])

    function appendToLastBot(chunk, sources) {
        setMessages((current) => {
            const next = [...current]
            const last = next[next.length - 1]
            next[next.length - 1] = {
                ...last,
                text: last.text + chunk,
                sources: sources ?? last.sources,
            }
            return next
        })
    }

    async function ask(rawQuestion) {
        const question = rawQuestion.trim()
        if (!question || loading) return

        setMessages((current) => [
            ...current,
            { role: "user", text: question },
            { role: "bot", text: "", sources: [] },
        ])
        setInput("")
        setLoading(true)

        try {
            const res = await fetch(`${API_URL}/api/chat/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            // Les fiches utilisées arrivent dans un en-tête, avant le corps du flux.
            const sources = parseSources(res.headers.get("X-Sources"))
            if (sources.length > 0) appendToLastBot("", sources)

            if (!res.body) {
                appendToLastBot(await res.text())
            } else {
                await readStream(res.body)
            }
        } catch {
            appendToLastBot(
                "Le serveur ne répond pas. Vérifie qu'Ollama et le backend Spring sont lancés (port 8080)."
            )
        } finally {
            setLoading(false)
        }
    }

    async function readStream(body) {
        const reader = body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            buffer = buffer.replace(/\r\n/g, "\n")

            let end
            while ((end = buffer.indexOf("\n\n")) !== -1) {
                const frame = buffer.slice(0, end)
                buffer = buffer.slice(end + 2)
                const data = parseSseFrame(frame)
                if (data) appendToLastBot(data)
            }
        }

        // Dernier événement éventuellement non terminé par une ligne vide.
        const tail = parseSseFrame(buffer)
        if (tail) appendToLastBot(tail)
    }

    function send(event) {
        event.preventDefault()
        ask(input)
    }

    const showSuggestions = messages.length === 1 && !loading

    return (
        <section className="pokedex-chat">
            <h1>Chat IA</h1>
            <p className="chat-hint">
                Réponses générées localement à partir des fiches PokeAPI indexées avec Ollama.
            </p>

            <div className="chat-messages" ref={messagesRef}>
                {messages.map((message, index) => {
                    const isPending = loading && index === messages.length - 1 && message.role === "bot" && !message.text
                    return (
                        <div key={index} className={`msg msg-${message.role}`}>
                            <div className="msg-text">{isPending ? "…" : message.text}</div>
                            {message.sources?.length > 0 && (
                                <div className="msg-sources">
                                    {message.sources.map((source) => (
                                        <span key={source} className="source-badge">
                                            {source}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {showSuggestions && (
                <div className="chat-suggestions">
                    {SUGGESTIONS.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => ask(suggestion)}>
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}

            <form className="chat-form" onSubmit={send}>
                <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ex. : Quel est le type de Pikachu ?"
                    aria-label="Question"
                />
                <button type="submit" disabled={loading || !input.trim()}>
                    {loading ? "…" : "Envoyer"}
                </button>
            </form>
        </section>
    )
}

// Un événement SSE peut contenir plusieurs lignes "data:" : on les recolle avec un saut de ligne.
// Attention : Spring n'ajoute pas d'espace séparateur après "data:", donc le premier espace
// d'une ligne fait partie du texte du modèle et ne doit pas être supprimé.
function parseSseFrame(frame) {
    return frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5))
        .join("\n")
}

function parseSources(header) {
    if (!header) return []
    return header
        .split(",")
        .filter(Boolean)
        // URLEncoder.encode (Java) encode les espaces en "+".
        .map((name) => decodeURIComponent(name.replace(/\+/g, " ")))
}

export default Chat
