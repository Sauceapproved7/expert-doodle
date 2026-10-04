const orderUrl="https://kaynatekitchen.com/";

function recommendDish({heat, craving}) {
  if (craving === "breakfast") return {name:"Ackee & Saltfish", note:"A Jamaican breakfast classic with traditional sides."};
  if (craving === "quick") return {name:"Beef Patty", note:"Fast, flaky and full of seasoned beef flavor."};
  if (craving === "rich") return {name:"Oxtail", note:"Slow-cooked, rich and built for a full comfort-food plate."};
  if (heat === "hot") return {name:"Jerk Chicken", note:"Smoky, spicy and unmistakably Jamaican."};
  if (heat === "medium") return {name:"Curry Goat", note:"Deep seasoning with a warm curry profile."};
  return {name:"Curry Chicken", note:"Comforting, familiar and easy to pair with rice and peas."};
}

function estimateCatering({guests, style}) {
  const count=Math.max(5,Math.min(250,Number(guests)||25));
  const factor=style==="hearty"?1.2:style==="light"?0.82:1;
  const entree=Math.max(2,Math.ceil((count/12)*factor));
  const starch=Math.max(2,Math.ceil(count/18));
  const veg=Math.max(1,Math.ceil(count/22));
  return {guests:count, entree, starch, veg};
}

const findDish=document.getElementById("findDish");
if(findDish){
  findDish.addEventListener("click",()=>{
    const match=recommendDish({
      heat:document.getElementById("heat").value,
      craving:document.getElementById("craving").value
    });
    document.getElementById("dishResult").innerHTML=
      '<span class="result-label">YOUR MATCH</span><strong>'+match.name+'</strong><p>'+match.note+
      '</p><a class="text-link" target="_blank" rel="noopener" href="'+orderUrl+'">Open live ordering ↗</a>';
  });
}

const buildCatering=document.getElementById("buildCatering");
if(buildCatering){
  buildCatering.addEventListener("click",()=>{
    const plan=estimateCatering({
      guests:document.getElementById("guests").value,
      style:document.getElementById("eventStyle").value
    });
    document.getElementById("cateringResult").innerHTML=
      '<span class="result-label">ESTIMATED STARTING POINT</span><strong>'+plan.guests+' guests</strong>'+
      '<p>Plan for about '+plan.entree+' entrée trays, '+plan.starch+' rice/side trays and '+plan.veg+
      ' vegetable/plantain trays.</p><small>Planning guide only. Call KayNate for final quantities, availability and pricing.</small>';
  });
}

function filterMenu() {
  const query=(document.getElementById("menuSearch")?.value||"").trim().toLowerCase();
  const availability=document.getElementById("availabilityFilter")?.value||"all";
  const rows=[...document.querySelectorAll(".menu-row")];
  let visible=0;
  for (const row of rows) {
    const name=(row.dataset.menuName||"").toLowerCase();
    const status=row.dataset.menuStatus||"";
    const show=(!query||name.includes(query))&&(availability==="all"||status===availability);
    row.hidden=!show;
    if(show) visible++;
  }
  for (const category of document.querySelectorAll(".menu-category")) {
    category.hidden=!category.querySelector(".menu-row:not([hidden])");
  }
  const count=document.getElementById("menuCount");
  if(count) count.textContent=visible+" menu item"+(visible===1?"":"s");
}

document.getElementById("menuSearch")?.addEventListener("input",filterMenu);
document.getElementById("availabilityFilter")?.addEventListener("change",filterMenu);

const menuCategoryNav=document.getElementById("menuCategoryNav");
if(menuCategoryNav){
  menuCategoryNav.addEventListener("click",(event)=>{
    const button=event.target.closest("[data-menu-category]");
    if(!button) return;
    const target=[...document.querySelectorAll(".menu-category")].find(section=>section.dataset.category===button.dataset.menuCategory);
    if(target){
      target.hidden=false;
      target.scrollIntoView({behavior:"smooth",block:"start"});
    }
  });
}
