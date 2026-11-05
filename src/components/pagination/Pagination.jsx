import './Pagination.css'
function Pagination({effect,page}) {
   function pageEffect(data,index){
   if(!isExtrem(index))
        effect(data)
   }
const tab = ["←","0",page/20+1,page/20+2,page/20+3,"50","→"]

function isExtrem(index) {
 return (index==0 && page==0) || (index==tab.length-1 && page/20==50) 
 
}


   return(<section>
        <p className='PageInfo'>Page : {page/20}</p>
                <div className='paginationBlock'>   
                        {tab.map((elem,index)=>{
                                return(<button  className={'pagination '+isExtrem(index)} onClick={(e)=>pageEffect(e.target.innerHTML,index)}>{elem}</button>)
                        })}
                  </div> 
        </section> )
}
export default Pagination