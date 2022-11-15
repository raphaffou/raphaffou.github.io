function includeHTML() {
    var z, i, elmnt, file, xhttp;
    /*loop through a collection of all HTML elements:*/
    z = document.getElementsByTagName("*");
    for (i = 0; i < z.length; i++) {
      elmnt = z[i];
      /*search for elements with a certain atrribute:*/
      file = elmnt.getAttribute("w3-include-html");
      if (file) {
        /*make an HTTP request using the attribute value as the file name:*/
        xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
          if (this.readyState == 4) {
            if (this.status == 200) {elmnt.innerHTML = this.responseText;}
            if (this.status == 404) {elmnt.innerHTML = "Page not found.";}
            /*remove the attribute, and call this function once more:*/
            elmnt.removeAttribute("w3-include-html");
            nodeScriptReplace(elmnt);
            includeHTML();
          }
        }      
        xhttp.open("GET", file, true);
        xhttp.send();
        /*exit the function:*/
        
        return;
      }
    }
  };
  const execScripts = [];
  function nodeScriptReplace(node) {
    if(!execScripts.includes(node.innerHTML)){
      if ( nodeScriptIs(node) === true ) {
        execScripts.push(node.innerHTML);
        node.parentNode.replaceChild( nodeScriptClone(node) , node );
      }
      else {
        var i = -1, children = node.childNodes;
        while ( ++i < children.length ) {
          nodeScriptReplace( children[i] );
        }
      }
    }

    return node;
}
function nodeScriptClone(node){
    var script  = document.createElement("script");
    script.text = node.innerHTML;

    var i = -1, attrs = node.attributes, attr;
    while ( ++i < attrs.length ) { 
          script.setAttribute( (attr = attrs[i]).name, attr.value );
    }
    return script;
}

function nodeScriptIs(node) {
    return node.tagName === 'SCRIPT';
}

  function routine() {
    includeHTML();
  }
  routine();
  setInterval(routine, 300);
  //listen for link click events at the document level
if (document.addEventListener) {
  document.addEventListener('click',interceptClickEvent);
}else if(document.attachEvent) {
  document.attachEvent('onclick', interceptClickEvent);
}