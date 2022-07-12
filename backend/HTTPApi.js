
//@ts-nocheck
import Express from 'express';
import ApiProvider from './ApiProvider.js';
import Api from '../common/Api.js';
import Fs from 'fs/promises';
import Path from 'path';
export default class HTTPApi extends ApiProvider{

    /**
     * @param {Object.<string, any>} config 
     * @param {Object.<string, any>} publicConfig 
     */
    constructor(config, publicConfig){
        super();
        this.config=config;
        if(config["devmode"]){
            process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
        }
        this.server=Express();
        this.server.use(Express.json({ limit: config.reqLimit }));
        this.server.use("/", Express.static(config.frontEndPath));
        this.server.use("/common", Express.static("common/"));

        this.server.get("/config.json", async (req, res) => {
            res.json(publicConfig);
            res.end();
        });

        this. server.use(function (err, req, res, next) {
            console.error(err.stack)
            res.status(200).json({ error: true, message: err.message });
        });
    
    
        this.server.listen(config.port, () => console.log(`HTTP server listening on port ${config.port}`));
    
    }

    /**
     * @public
     * @param {string} path 
     * @param {import('./ApiProvider').ApiAction} action 
     * @returns {void}
     */
    async registerApi(path, action){
        const api=new Api(path,async (key)=>{
            const f=Path.join(this.config.schemaPath,key)+".json";
            return JSON.parse(await Fs.readFile(f));
        });
     
        this.server.post("/"+path, async (req, res) => {      
            try {        
                const data=await api.parse("request",req.body);
                const resp=await api.parse("response",await action(data));
                res.json(resp);            
            } catch (e) {
                console.error(e);
                res.json( {
                    error:  e + ""
                });
            }
            res.end();
        });    


        // documentation
        this.server.get("/apidoc/"+path+"/request", async (req,res)=>{
            res.type('json').send(JSON.stringify(await api.getDefByType("request"), null, 2) + '\n');
            res.end();
        });
        this.server.get("/apidoc/"+path+"/response", async (req,res)=>{
            res.type('json').send(JSON.stringify(await api.getDefByType("response"), null, 2) + '\n');
            res.end();
        });

        if(!this.apiEndPoints){
            this.server.get("/apidoc", async(req,res)=>{
                res.type('json').send(JSON.stringify(this.apiEndPoints, null, 2) + '\n');
                res.end();
            });
            this.apiEndPoints=[];
        }
        this.apiEndPoints.push({
            method:"POST",
            path:"/"+path,
            requestDoc:"/apidoc/"+path+"/request",
            responseDoc:"/apidoc/"+path+"/response",
        });
    }
}