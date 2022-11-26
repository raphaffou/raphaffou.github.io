function date_to_String(date){
    return String(date.day) + "/" + String(date.month) + "/" + String(date.year);
}   

function whenInput(e){
    let query = e.target.value.toLowerCase();
    details.forEach((projet) => {
        const isVisible = projet.name.includes(query) || projet.text.includes(query);
        projet.ele.classList.toggle("hide", !isVisible);
    });
}
let details = [];

function forceRefresh(s){
    document.getElementById("main").innerHTML = "<div w3-include-html=\""+s+"\"></div>";
}

function projetLoadingRoutine() {
    document.getElementById('search').removeEventListener('input', whenInput);
    const projetCardTemplate = document.getElementById("card-template");
    const getprojets = async () => {
        const res = await fetch("json/projets.json");
        const projets = await res.json();
        details = projets.map((projet, i) => {
            const card = projetCardTemplate.content.cloneNode(true);
            card.getElementById("name").innerText = projet.name;
            card.getElementById("link").setAttribute("onclick", "forceRefresh(\""+projet.link+"\");") ;
            card.getElementById("date").innerText = date_to_String(projet.date);
            card.getElementById("projtext").innerText = projet.text.substring(0, 50) + "...";
            document.getElementById("cards-wrapper").append(card);
            return {
                name: projet.name.toLowerCase(),
                text: projet.text.toLowerCase(),
                ele: document.querySelectorAll(".card")[i]
            };
        });
    };
    getprojets();
    
    const input = document.getElementById("search");
    input.addEventListener("input", whenInput);
}