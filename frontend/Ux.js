import Stage0 from './stages/Stage0.js';
import Stage1 from './stages/Stage1.js';
import Stage2 from './stages/Stage2.js';
import Stage3 from './stages/Stage3.js';
import Utils from './Utils.js';
import Tasks from './Tasks.js';
export default class Ux {
    static async init(window,config){
        this.window=window;
        this.config=config;

        this.stages=[
            new Stage0(),
            new Stage1(),
            new Stage2(),
            new Stage3()

        ];


        const query=Ux.getQuery();
        if(query.embedded){
            setInterval(()=>{
                parent.postMessage(JSON.stringify({
                    name:"split-donation-resize",
                    height:Math.max(document.body.scrollHeight||0,
                        document.documentElement.scrollHeight||0,document.height||0,document.documentElement.clientHeight||0
                        ,document.body.clientHeight||0
                        )
                }),"*");  
            },1000);
            document.querySelector("body").style.setProperty('background-color', 'transparent', 'important');
        }

        
    }
    
    static async getConfig(){
        return this.config;
    }
    
    static async getTargets(){
        let targets= (await this.getConfig()).targets;
        if(typeof targets=="string"){
            if(targets.startsWith("https://")||targets.startsWith("http://")){
                targets=await fetch(targets).then(res=>res.json());
            }
        }
        const enableTargets=this.getQuery().enableTargets;
        return targets.filter(t=>typeof t.enabled=="undefined"||t.enabled||(enableTargets&&enableTargets.indexOf(t.id)!=-1));
    }

    static async backupPayData(paydata){
        if(!this.window.localStorage)throw "Local storage not supported by this browser";
        let newId=0;
        while(true){
            if(!this.window.localStorage.getItem("paydata-"+newId)){
                break;
            }
            newId++;
        }
        this.window.localStorage.setItem('paydata-'+newId,JSON.stringify(paydata));
    }

    static getPayDataBackups(){
        if(!this.window.localStorage)throw "Local storage not supported by this browser";
        const out=[];
        let lastId=0;
        while(true){
            const payData=this.window.localStorage.getItem("paydata-"+lastId);
            if(payData)out.push(JSON.parse(payData));
            else break;
            lastId++;
        }
        return out;
    }


    static setQuery(d){
        this.window.location.hash="#"+btoa(JSON.stringify(d));

    }

    static getQuery(){
        const hash=this.window.location.hash?this.window.location.hash.substring(1):"";
        if(!hash)return {};
        return JSON.parse(atob(hash));

    }
    
    static async setPayData(paydata){
        const query=this.getQuery();
        query.payData=paydata;
        this.setQuery(query);

    }

    static async getPayData(){
        const query=this.getQuery();
        return query.payData;
    
    }
    static setSubtitle(subtitle){
        const el=document.getElementById("subtitle");
        if(el)el.innerHTML=subtitle;
    }
    static setTitle(title,browserTitle){
        const el=document.getElementById("title");
        if(el)el.innerHTML=title;
        document.title=browserTitle||title;
    }
  

    static async showStage(id, config, payData) {
        try {
            if (!config) {
                config = await this.getConfig();
            }

            if (!payData) {
                payData = await this.getPayData();
            }

            if (!payData) {
                payData = {
                    donateExtraFee: config["devmode"] ? "pay@alice-lnsplitpay.test" : "rblb@getalby.com",
                    sats: config.defaultAmountSats,
                    preferredCurrency: "SATS",
                    lndhub: config.lndhub,
                    targets: await this.getTargets()
                };
                if (typeof id == "undefined") id = 0; // if paydata unset, default stage is 0
            } else {
                if (typeof id == "undefined") id = 3; // if paydata is set, default stage is 2
            }


            const stageContent = document.querySelector("#content");

            if (this.currentStage) {
                console.info("Close stage ", this.currentStageId);
                await this.currentStage.close();
                this.currentStage = undefined;
            }

            console.info("Show stage ", id);
            this.currentStageId = id;
            this.currentStage = this.stages[id];
            await this.currentStage.show(config, payData, stageContent);

        } catch (e) {
            console.error(e);
            Tasks.error("stage-load", `Can't load stage ${id}`, true);
        }


    }
}