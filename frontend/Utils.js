import Api from "../common/Api.js";
import {sha256} from "./thirdparty/sha256.js"
export default class Utils{
    static init(window,config){
        this.window=window;
        this.config=config;
    }

    static randomString(){
        return this.window.crypto.getRandomValues(new BigUint64Array(2)).reduce(
            (prev, curr, index) => (
                !index ? prev : prev.toString(36)
            ) + (
                index % 2 ? curr.toString(36).toUpperCase() : curr.toString(36)
            )
        );
        
    }
    static async sleep(ms) {
        if (!ms || ms < 0 || isNaN(ms)) return;
        await new Promise((res, rej) => setTimeout(res, ms));
    }
    static async download(data, filename, type) {
        const file = new Blob([data], { type: type });
        const a = document.createElement("a");
        const url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 1);

    }

    static anonimizeInvoice(inv){
        function hash(v){
            if(!v)return "empty";
            return "sha256-"+sha256("spd-"+sha256(v));
        }
        function anonAddr(addr){
            if(!addr)return "!!empty";

            const parts=addr.split("@");
            parts[0]=hash(parts[0]);
            if(parts[1]){
                const c=(parts[1].length/2)
                let p2=parts[1].substring(c);
                let p1="";
                for(let i=0;i<c;i++)p1+="*";
                parts[1]=p1+p2;
            }
            return parts.join("@");
        }
        function anonUrl(url){
            if(!url)return "!!empty";
            const c=(url.length/2)
            let p2=url.substring(c);
            let p1="";
            for(let i=0;i<c;i++)p1+="*";
            url=p1+p2;
            return url;
        }

        const anon={
            donateExtraFees:anonAddr(inv.donateExtraFees),
            sats:inv.sats,
            preferredCurrency:inv.preferredCurrency,
            lndhub:anonUrl(inv.lndhub),
            fee:inv.fee,
            computed:inv.computed,
            invoice: hash(inv.invoice),
            payHash: hash(inv.payHash),            
            targets:[]
        };

        for(const tg of inv.targets){
            const atg={};
            anon.targets.push(atg);
            atg.type=tg.type;
            atg.sats=tg.sats;
            atg.status=tg.status;
            atg.minSats=tg.minSats;
            if(tg.invoice){
                atg.invoice={
                    invoice:hash(tg.invoice.invoice),
                    payHash:hash(tg.invoice.payHash),
                    sats:tg.sats,
                    timestamp:tg.timestamp,
                    expiry:tg.expiry                    
                };  
            }
            atg.computedMinWeight=tg.computedMinWeight;
            atg.weight=tg.weight;
            
            if(tg.type=="lightning-address"){ 
                atg.addr=anonAddr(tg.addr);
                           
            }else if(tg.type=="opencollective"){
                atg.collective=hash(tg.collective);
                atg.depositAddress=anonAddr(tg.depositAddress);
            }
            
        }

        return anon;
        
    }


    static html(content, aux){
        const el=document.createElement(aux?aux:"div");
        el.innerHTML=content;
        if(el.children.length>1) {
            console.log("Multiple elements "+el);
            return el;
        }
        else {
            if(!el.firstElementChild)throw new Error( "No element?");
            console.log("Single element ",el);
            return el.firstElementChild;
        }

    }

    static secondsToHms(d) {
        d = Number(d);
        var h = Math.floor(d / 3600);
        var m = Math.floor(d % 3600 / 60);
        var s = Math.floor(d % 3600 % 60);
    
    
        return `${h}:${m}.${s}`
    }
    static async fetchBackend(resource,postData,retry){
        const api=new Api(resource,async (key)=>{
            let res;
            for(let i=0;i<(retry?retry:60);i++){
                res=await fetch(`/${this.config.schemaPath+(this.config.schemaPath.endsWith("/")?"":"/")}${key}.json`)
                if(!this.isSuccessHttpCode(res.status)){
                    await Utils.sleep(1000);
                    continue;
                }
                break;
            }
            return  res=await res.json();
        });

        postData=await api.parse("request",postData);
        let resp;
        let lastE;
        for(let i=0;i<(retry?retry:60);i++){
            resp=await fetch(resource,{
                method:"POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache',

                body:JSON.stringify(postData)
            });
            
            if(!this.isSuccessHttpCode(resp.status)){
                await Utils.sleep(1000);
                continue;
            }

            resp = await resp.json();
            resp=await api.parse("response",resp);
           
            if(resp.error){
                lastE=resp.error;
                await Utils.sleep(1000);
                continue;
            }
            lastE=undefined;
            break;
        }
        if(lastE)throw lastE;
        return resp;
      
        
    }


    static isSuccessHttpCode(code){
        const codeString=code.toString();
        return codeString.startsWith("2") || codeString.startsWith("3");
    }

    static clone(obj){
        return JSON.parse(JSON.stringify(obj));
    }

    static toHex(a){
        function i2hex(i) {
            return ('0' + i.toString(16)).slice(-2);
          }
        return Array.from(a).map(i2hex).join('');
    }

    static async resolveWeights(targets,weightSum,editedTarget){
        if(targets.length==0)return targets; 

       

        // if(!weightSum){
        //     weightSum=0;
        //     for(let target of targets){
        //         weightSum+=typeof target.weight === "undefined"?1:target.weight
        //     }
        // }

       
        // console.log(editedTarget);
      
        
        // if( editedTarget){
        //     console.log("a");
        //     if(editedTarget&&editedTarget.minWeight&&editedTarget.weight<editedTarget.minWeight)editedTarget.weight=editedTarget.minWeight;
        //     if(weightSum!=1){
        //         let delta=1.-weightSum;
        //         let c=delta/(targets.length-1);
        //         let deltaAbs=Math.abs(delta);
        //         console.log("a");
                
        //         await new Promise((res, rej) => {
        //             const loop = async () => {
        //                 console.log(111);

        //                 if(deltaAbs<=0.001){
        //                     res();
        //                     return;
        //                 }
        //                 let nochange=true;
        //                 for(let i=0;i<2;i++){
        //                     for (const target of targets) {
        //                         if (target != editedTarget || i!=0) {
        //                             const updateWeight = target.weight + c;
        //                             if(updateWeight<(target.minWeight||0)){
        //                                 const oldWeight=target.weight;
        //                                 target.weight = (target.minWeight||0);
        //                                 console.log("Force weight",target.weight);
        //                                 deltaAbs=deltaAbs-Math.abs(target.weight-oldWeight);
        //                             }else if(updateWeight>1){
        //                                 const oldWeight=target.weight;
        //                                 target.weight = 1;
        //                                 deltaAbs=deltaAbs-Math.abs(target.weight-oldWeight);
        //                             }else{
        //                                 target.weight = updateWeight;
        //                                 deltaAbs=deltaAbs-Math.abs(c);
        //                                 nochange=false;
        //                             }
        //                         }
        //                     }
        //                     if(!nochange)break;
        //                 }
        //                 setTimeout(loop, 1);
        //             }
        //             loop();
        //         });


        //     } 
        // }
        for(const target of targets){
            if(!target.weight)target.weight=0;
            if(target.minWeight&&target.weight<target.minWeight)target.weight=0;
        }
        if(!weightSum){
            weightSum=0;
            for(let target of targets){
                weightSum+=typeof target.weight === "undefined"?1:target.weight
            }
        }
            
        // }else{
            for(const target of targets){
                
                // const w=typeof target.weight === "undefined"?1:target.weight;
                target.weight=Math.floor(target.weight/weightSum*1000)/1000;
            }

            // this.resolveWeights(targets,1.,null)
        // }

        // let currentWeightSum=0;
        // let largestTargetW;
        // let largestTargetI;
        // for(let i =0;i<targets.length;i++){
        //     const target=targets[i];
        //     currentWeightSum+=target.weight;
        //     if(!largestTargetW||target.weight>largestTargetW){
        //         largestTargetI=i;
        //     }
        // }

        // let deltaWeightSum=1-currentWeightSum;
        // // targets[largestTargetI].weight+=deltaWeightSum;
        // for(const target of targets)target.weight+=target.weight*deltaWeightSum;

        // if(deltaWeightSum>0){
        //     // deltaWeightSum/=targets.length;
        //     const rand=Math.floor(Math.random()*targets.length);
        //     targets[rand].weight+=deltaWeightSum;
        //     // for(const target of targets)target.weight+=deltaWeightSum;
        // }

        return targets;
    }
}