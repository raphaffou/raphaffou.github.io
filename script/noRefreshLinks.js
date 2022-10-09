const collection = document.getElementsByClassName("link");
var content = document.getElementById("main");
function noref() {
    for (let i = 0; i < collection.length; i++) {
        collection[i].onclick = function() {
            content.innerHTML = "<div w3-include-html=\""+collection[i].getAttribute("src")+"\"></div>";
        }
    }
}
