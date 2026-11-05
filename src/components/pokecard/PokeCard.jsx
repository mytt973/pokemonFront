import { Navigate, useNavigate } from 'react-router-dom'
import './pokeCard.css' 
 function PokeCard({name,id}){
const nav =useNavigate()
const imgUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/"+id+".png"; 
function clickEvent(e) {
    nav("/detail/"+id)
}
    return(<li  className={id%2==0?'liA':'liB'}>
      <a>{id}</a>
        <a>{name}</a>
        <img className='imgUrl' src={imgUrl}/>
        <button className='btnLi' onClick={clickEvent}>voir plus</button>
        </li>
)}
export default PokeCard