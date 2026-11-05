import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import ApiPoke from "../service/ApiPoke"

function PokeDetails() {
    const [data,setData] = useState()
    const {id} = useParams()

      useEffect(()=> {
         const saved = localStorage.getItem("detail "+id);
         if (saved) setData( JSON.parse(saved));
        else{
           ApiPoke.get("/"+id).then(res=>{
              setData(res.data)
                localStorage.setItem("detail "+id, JSON.stringify(res.data));
           })
        }
          
          
        },[])
   
const imgUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/"+id+".png"; 
let tab=[]
if(data)
    {
    console.log(data);
 tab=[
    {title:"id",elem:<ol>{id}</ol>},
    {title:"name",elem:<ol>{data.name}</ol>},
    {title:"experience",elem:<ol>{data.base_experience}</ol>},
    {title:"hauteur",elem:<ol>{data.height}</ol>},
    {title:"largeur",elem:<ol>{data.weight}</ol>},
    {title:"order",elem:<ol>{data.order}</ol>},
  
    {title:"ability",elem:data.abilities.map((e,index) => {return(
                    <ol>{e.ability.name}</ol>)})},

    {title:"type",elem:data.types.map((e,index) => {return(
                    <ol>{e.type.name}</ol>)})},

    {title:"generation",elem:data.past_stats.map((e,index) => {return(
                    <ol>{e.generation.name}</ol>)})},
]}

return<section>
    <div>
           <img className='imgUrl' src={imgUrl}/>
    </div>
{tab.map((ligne,index)=>{return(
    <div className="listed">
    <ol><strong>{ligne.title}</strong></ol>
   {ligne.elem}
</div>
)})}

</section>



}

export default PokeDetails

