
import './App.css'
import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import PokeDetails from './pages/PokeDetails'
import Chat from './pages/Chat'

function App() {
    // useEffect(()=> {
    //  fetch("https://pokeapi.co/api/v2/pokemon/"+id).then((res)=>{
    //     return  res.json()
    //  }).then((r)=>{
    //      setData(r)
    //  })
    
    // },[])
// console.log(data.name)

  return (
    <>
    <nav className="app-nav">
           <Link to={'/home'}>Pokédex</Link>
           <Link to={'/chat'}>Chat IA</Link>
        </nav>

  <Routes>
    <Route path='/detail/:id' element ={<PokeDetails/>}/>
    <Route path='/home' element={<Home/>} />
    <Route path='/' element={<Home/>} />
    <Route path='/chat' element={<Chat/>} />
  </Routes>
  </>)
}

export default App
