import axios from "axios";
 function dd(params) {
    if(!params) return  
    const saved = localStorage.getItem(params.toLocaleLowerCase());
  if (saved) return JSON.parse(saved);
  let data = "justeUnTest"

    axios.create({baseURL :"https://pokeapi.co/api/v2/pokemon"}).get(params)
    .then(res=>{
              if(res.status==200){
                 data =  res.data;
                 console.log(res.data);
                 
                  try {
                    localStorage.setItem(params.toLocaleLowerCase(), JSON.stringify(data));
                  
                 } catch {
                    console.log("Limite (~5 Mo) dépasser");
                }
              }
    
}).catch(
    err=>{console.log("call Api not worck"+err)
    })
      return data;
}


const   CallApi={
url:"https://pokeapi.co/api/v2/pokemon",
get:dd
}
// CallApi.setUrl(d)
 export default axios.create({baseURL :"https://pokeapi.co/api/v2/pokemon"})