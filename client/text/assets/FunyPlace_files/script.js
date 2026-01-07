let websocket;
let canvas;
let context;

let lock = false;
let showcoords = false;
let moving = false;
let zoom = 1;
let selected;
//Position of canvas
let xoff = innerWidth/2-800;
let yoff = innerHeight/2-800;
//Mouse start position
let startpos = {x: 0, y: 0};
let touchdist = 0;
let mpos = [0, 0];
let zoomstep = innerWidth > innerHeight ? 1.1 : 1.05;
const colors = ["white", "grey", "black", "red", "orange", "yellow", "green", "cyan", "blue", "lime", "#6500a8", "purple", "#5E270B", "#282828", "#ff00f7", "#AB8266", "#F65E26", "maroon", "#3B9EF4"];
const player = {
    color: 3,
    username: "Anonymous"
}

//Cookie management
const cookieobject = {};
document.cookie.split("; ").forEach((cookieitem) => {
    cookieobject[cookieitem.substring(0, cookieitem.indexOf("="))] = decodeURIComponent(cookieitem.substring(cookieitem.indexOf("=") + 1, cookieitem.length))
})
function compilecookie() {
    var date = new Date();
    date.setDate(new Date().getDate() + 365);
    Object.keys(cookieobject).forEach(cookieitem => {
        document.cookie = cookieitem + "=" + cookieobject[cookieitem] + "; expires=" + date + "; path=/";
    })
}

//Functions
function placepixel(x, y, color){
    context.fillStyle = colors[color];
    context.fillRect(x*2, y*2, 2, 2);
}
function sel(color, element){
    selected.className = "coloropt";
    selected = element;
    selected.className = "selected coloropt";
    player.color = color;
}
function movecanv(mouse){
    //Show mouse coordinates
    const x = Math.floor((mouse.clientX - xoff)/(2*zoom));
    const y = Math.floor((mouse.clientY - yoff)/(2*zoom));
    if(y>=0 && y <= 800 && x>=0 && x<=800) document.getElementById("coords").innerHTML = "x: "+x + " y: " + y;
    //Move the canvas
    if(!moving) return;
    //New canvas position
    xoff = mouse.clientX - startpos.x;
    yoff = mouse.clientY - startpos.y;
    canvas.style.left = xoff;
    canvas.style.top = yoff;
}
function zoomcanv(wheel){
        //ignore if zooming out of bounds
        if(wheel.deltaY > 0 && zoom < 0.3 || wheel.deltaY < 0 && zoom > 12) return;
        var xs = (wheel.pageX - xoff)/zoom;
        var ys = (wheel.pageY - yoff)/zoom;
        //Zoom in or out + find new offset
        zoom = wheel.deltaY>0 ? zoom/zoomstep : zoom*zoomstep
        xoff = wheel.pageX - xs * zoom
        yoff = wheel.pageY - ys * zoom;
        //Move canvas and show zoom
        canvas.style.left = xoff;
        canvas.style.top = yoff;
        canvas.style.transform = "scale("+zoom+")";
}

window.onload = ()=>{
    //NOTE: All cookie values are string?
    if(cookieobject.loaded != 'true') document.getElementById("welcome").style.display = "block";
    cookieobject.loaded = true;
    compilecookie();

    canvas = document.getElementById("place");
    context = canvas.getContext("2d");
    selected = document.getElementsByClassName("coloropt")[0];
    websocket = new WebSocket("wss://"+location.hostname+":"+location.port);
    delete WebSocket;

    websocket.onmessage = msg=>{
        msg = JSON.parse(msg.data);
        if(Array.isArray(msg)){
            let x = 0;
            let y = 0;
            msg.forEach(pxl=>{
                placepixel(x, y, pxl);
                x++;
                //Note that it's 199 as it starts at 0
                y = x>799 ? y+1 : y;
                x = x>799 ? 0 : x;
            })
            start();
        } 
        //TODO: Get rid of this chain
        else if(msg.type == 100){
            placepixel(msg.x, msg.y, msg.color);
        } else if(msg.type == 401){
            document.getElementById("error_content").innerHTML = `<h1>SLOW DOWN!</h1><p>You're sending pixels too fast! <a href='/'>refresh</a></p>`
        } else if(msg.type == 402){
            document.getElementById("error_content").innerHTML = `<h1>Server Update!</h1><p>The server has been restarted, <a href='/'>refresh</a>.</p>`
        } else if(msg.type == 405){
            document.getElementById("error_content").innerHTML = `<h1>SERVER LOCKDOWN</h1><p>A BOT IS USING 20+ IPS TO TRY AND CLEAR THE CANVAS. THE SERVER IS LOCKED TO PREVENT THAT. COME BACK IN 10 MINUTES.</p>`
        } else if(msg.type == 101) alert(msg.content);
        //NOTE: 300 is for debug, 100 is for content, 400 is for error
        else if(msg.type == 300) console.log(msg.content)
    }
    websocket.onclose = ()=>{
        document.getElementById("error").style.display = "block";
    }
}

function start(){
    //Handle moving
    document.addEventListener("mousedown", (mouse)=>{
        if(lock || mouse.button == 2) return;
        //Mouse start position on canvas
        startpos = {x: mouse.clientX - xoff, y: mouse.clientY - yoff};
        moving = true;
    })
    canvas.addEventListener("mousedown", mouse=>{
        if(mouse.button == 2) return;
        mpos = [mouse.clientX, mouse.clientY];
    })
    document.addEventListener("mouseup", (mouse)=>{
        if(mouse.button == 2) return;
        moving = false;
        if(mouse.clientX == mpos[0] && mouse.clientY == mpos[1] || lock){
            let canv = canvas.getBoundingClientRect(); 
            placepixel(Math.floor((mouse.clientX - canv.left)/(2*zoom)),  Math.floor((mouse.clientY - canv.top)/(2*zoom)), player.color);
            websocket.send(JSON.stringify({
                type: 100,
                x: Math.floor((mouse.clientX - canv.left)/(2*zoom)),
                y: Math.floor((mouse.clientY - canv.top)/(2*zoom)),
                color: player.color
            }));
        }
    })
    document.addEventListener("mousemove", movecanv)
    canvas.addEventListener("touchmove", (touch)=>{
        if(lock) return;
        if(touch.touches[1] != undefined){
            let ldist = touchdist;
            let deltaY = 0;
            let midx = (touch.touches[0].clientX + touch.touches[1].clientX)/2;
            let midy = (touch.touches[0].clientY + touch.touches[1].clientY)/2;
            touchdist = Math.sqrt(Math.abs((touch.touches[1].clientX - touch.touches[0].clientX)) + Math.abs((touch.touches[1].clientY - touch.touches[0].clientY)));
            deltaY = touchdist>ldist ? -1 : 1;
            zoomcanv({pageX: midx, pageY: midy, deltaY: deltaY});
            return;
        }
        if(!moving){
            moving = true;
            startpos = {x: touch.touches[0].clientX - xoff, y: touch.touches[0].clientY - yoff};
        }
        movecanv(touch.touches[0]);
    })
    document.addEventListener("touchend", ()=>{
        moving = false;
    })
    document.addEventListener("wheel", zoomcanv)
    document.addEventListener("keyup", key=>{
        if(key.which == 32){
            lock=!lock;
            document.getElementById("lock").style.display = lock ? "inline-block" : "none";
        } else if(key.which == 48){
            showcoords = !showcoords
            document.getElementById("coords").style.display = showcoords ? "inline-block" : "none";
        }
        else if(key.which == 72) document.getElementById("welcome").style.display = "block";
    })
}