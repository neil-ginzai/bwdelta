/*
CODE BY FUNE. FUNE-ISHED ON 17/01/2024
If you wanna use this library feel free, but it sucks and god knows why you'd want to
*/

class styleobject{
    constructor(width, height, swidth, sheight, image, anims){
        this.width = width;
        this.height = height;
        this.image = image;
        this.anims = anims;
        this.swidth = swidth;
        this.sheight = sheight;
        this.playing = false;
    }

    play(animno, mspf){
        if(this.playing) clearInterval(this.animator);
        this.playing = true;
        let anim = this.anims[animno];
        let i = 0;
        let options = {};
        if(anim == undefined){
            let options = {};
            setTimeout(()=>{if(options.onend != undefined) options.onend()}, 500);
            return options;
        }
        this.animator = setInterval(()=>{
            //End if overshot
            if (i<anim.length){
                //Set to current frame
                let left = anim[i]*this.width;
                let top = this.height * Math.floor(left/this.swidth);
                left %= this.swidth;
                this.self.style.backgroundPosition = "left -"+left+"px top -"+top+"px";
                //Inc frame
                i++;
            }
            else{
                clearInterval(this.animator);
                this.playing = false;
                //Run the end function
                if(options.onend != undefined) options.onend();
            }
        }, mspf)
        //Editable object so onend can be set
        return options;
    }

    enter(id, parent, animation, rate, startingframe){
        this.id = id;
        let left = startingframe*this.width;
        let top = this.height * Math.floor(left/this.swidth);
        left %= this.swidth;
        document.getElementById(parent).insertAdjacentHTML("beforeend", "<div style='width:"+this.width+";height:"+this.height+";background-image:url(\""+this.image+"\");background-position: left -"+left+"px top -"+top+"px;' id='"+id+"'></div>");
        this.self = document.getElementById(id);

        //A rate of 0 implies no entry animation.
        if(rate>0) this.play(animation, rate);
    }

    kill(){
        this.self.remove();
    }
}

//Useful to add in for spritesheets, JS doesn't have a default range function
function range(bottom, to){
    let x = [];
    for(i=bottom;i<=to;i++){
        x.push(i);
    }
    return x;
}