const collection1 = document.getElementsByClassName("link");
var content = document.getElementById("main");
function noref() {
    for (let i = 0; i < collection1.length; i++) {
        collection1[i].onclick = function() {
            content.innerHTML = "<div w3-include-html=\""+collection1[i].getAttribute("src")+"\"></div>";
        }
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