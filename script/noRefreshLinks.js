var content = document.getElementById("main");
/* obsolete
const collection1 = document.getElementsByClassName("link");
function noref() {
    for (let i = 0; i < collection1.length; i++) {
        collection1[i].onclick = function() {
            content.innerHTML = "<div w3-include-html=\""+collection1[i].getAttribute("src")+"\"></div>";
        }
    }
} */

function interceptClickEvent(e) {
    var href;
    var target = e.target || e.srcElement;
    if (target.tagName === 'A' && target.getAttribute('target') != '_BLANK') {
        href = target.getAttribute('href');
        content.innerHTML = "<div w3-include-html=\""+href+"\"></div>";
        //tell the browser not to respond to the link click
        e.preventDefault();
        console.log("j'ai bien intercepté !");
    }
}



/* ne marche pas correctement
function traitementJson(data,idtable,idhead) {
    var titles = document.getElementById(idhead);
    var table = document.getElementById(idtable);
    var tableRow = [];
    
    for (const [key, value] of Object.entries(data[0])){
        table.innerHTML += '<tr id="row'+ idtable + key + '"></tr>';
        titles = document.getElementById("row"+idtable+key);
        for (var i = 0; i < data.length; i+=2) {
            console.log(data[i]);
            if(key == "Matières"){
                titles.innerHTML += "<th>"+(data[i]["Matières"])+"</th>";
                continue;
            }    
            titles.innerHTML += "<td>"+key+":"+value+"</td>";
        }
        
    }
}*/