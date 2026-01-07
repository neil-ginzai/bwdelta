/*
LIBRARY MADE BY FUNE FOR BONZIWORLD REWRITE
STARTED FEB 2024
Feel free to use this in your own projects, though there's no documentation.
The approach taken is not the best.
*/

function contextmenu(content, x, y, passthrough, id, ignore){
	if(id != undefined) killmenus(id);
	id = document.createElement("ul");
	id.id = "menu";
	id.className = "contextmenu_cont";
	id.style.top = y;
	content.forEach(item=>{
		let option = document.createElement("li");
		option.className = item.disabled ? "cmenu_disabled" : "cmenu_item";
		id.appendChild(option);
		option.innerHTML = item.name;
		option.onmouseover = ()=>{if(id.childmenu != undefined) killmenus(id.childmenu);};
		if(item.type == 0 && !item.disabled){
			option.onmouseup = ()=>{killmenus(window.cont);window.cont=undefined;item.callback(passthrough);};
		} else if(item.type == 1){
			option.className += " cmenu_list"
			option.onmouseover = ()=>{if(id.childmenu != undefined) killmenus(id.childmenu); id.childmenu = contextmenu(item.items, x+id.clientWidth, option.getBoundingClientRect().top, passthrough, id.childmenu, true)};
		}
	})
	document.body.appendChild(id);
	if (x>innerWidth-id.clientWidth && !ignore) x-=id.clientWidth;
	id.style.left = x;
	return id;
}

function killmenus(id){
	if(id.childmenu != undefined) killmenus(id.childmenu);
	id.remove();
	delete id;
}