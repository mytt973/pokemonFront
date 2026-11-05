import { useEffect, useState } from "react"
import ApiPoke from "../service/ApiPoke"
import PokeCard from "../components/pokecard/PokeCard"
import Pagination from "../components/pagination/Pagination"

function Home() {
    const [pagi,SetPagi] = useState(0)
    const [poke,setPoke]= useState([])
    useEffect(()=>{
         const saved = localStorage.getItem("Page "+pagi);
         if (saved) setPoke( JSON.parse(saved));
        else{
         ApiPoke.get("/?offset="+pagi+"&limit="+20).then(res=>{
        setPoke(res.data.results)
        localStorage.setItem("Page "+pagi, JSON.stringify(res.data.results));
        });
    }
       
        
    },[pagi])

    console.log(poke);
    
    function changPage(int) {
    let res = pagi
    switch (int) {//todo maximum
        case "→":
            res+=20
            break;
        case "←":
                res-=20
            break;  
        case "...":

            break;  
        default:
            if(!Number.isNaN(int)){
                res=(int*20)
            }
          break; 
    }           
    SetPagi(res) 
}

return <section>
    <h1>Home</h1>
    <div>
    <p>Liste des pokemons</p>

   <ol>
    {poke.map((e,index)=>{return<PokeCard  key={index} id={1+index+pagi} name={e.name}/>})}
  </ol>
    </div>
   <Pagination page={pagi} effect={changPage}/>
    </section>
}
export default Home;


//detail css
//icon/logo/img type https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-viii/brilliant-diamond-shining-pearl/13.png
//barre de recherche
//plus de state
// suivant (pokemon suivant [pagi+-1])
//from to add poke with From


//error message (url/call api/autre/loading)
//csss Tailwin + prtillzur


//create Hook 
//add useContexte etc...