//@ts-check
import HTTPApi from './HTTPApi.js';
import LightningModule from './LightningModule.js';
import GithubModule from './GithubModule.js';
import CurrencyConversionModule from './CurrencyConversionModule.js';
import FixedFloatRoutingModule from './FixedFloatRoutingModule.js';
import Fs from 'fs/promises';
import Path from 'path';
import Database from './Database.js';
import createDOMPurify from 'dompurify';
import Sane from '../common/Sane.js';
import { JSDOM } from 'jsdom';
import JSON5 from 'json5';
import fetch from 'node-fetch';
/**
 * 
 * @param {boolean} onlyPublic 
 * @returns {Promise<any>}
 */
async function loadConfigs(onlyPublic) {
    if (process.env.CONFIG_PATH) {
        let config = (await Fs.readFile(Path.join(process.env.CONFIG_PATH, "config.jsonc"))).toString();
        config = JSON5.parse(config);
        if (!onlyPublic) {
            let backendConfig = (await Fs.readFile(Path.join(process.env.CONFIG_PATH, "backend.jsonc"))).toString();
            backendConfig = JSON5.parse(backendConfig);
            for (let k in (/** @type {any} */ (backendConfig))) {
                config[k] = backendConfig[k];
            }
        }
        return config;
    } else {
        let config = process.env.CONFIG;
        config = config? JSON.parse(config):undefined;
        if (!config) throw "Please export CONFIG env variable";
        if (!onlyPublic) {
            let backendConfig = process.env.BACKEND_CONFIG;
            backendConfig = backendConfig?JSON.parse(backendConfig):undefined;
            if (!backendConfig) throw "Please export BACKEND_CONFIG env variable";
            for (let k in (/** @type {any} */ (backendConfig))) {
                config[k] = backendConfig[k];
            }
        }
        return config;
    }
}
 async function getTargets(config){
    let targets= config.targets;
    if(typeof targets=="string"){
        if(targets.startsWith("https://")||targets.startsWith("http://")){
            targets=await fetch(targets).then(res=>res.json());
        }
    }
    return targets;
}

async function main() {
 
    const  /** @type {any}*/ window = new JSDOM('').window;

    const DOMPurify = createDOMPurify(window);
    Sane.init(DOMPurify);

    const config =  await loadConfigs(false);
    const publicConfig =  await loadConfigs(true);

    const apiProvider = new HTTPApi(config, publicConfig);


    const currencyCnvModule = new CurrencyConversionModule(config);
    await currencyCnvModule.register(apiProvider);


    const fixedFloatModule = new FixedFloatRoutingModule(config);
    await fixedFloatModule.register(apiProvider);


    const githubModule = new GithubModule(
        new Database(config.githubData),
        config.githubReqCooldown,
        config.githubLogsRange,
        config.githubGistConfigFileNames||[config.githubGistConfigFileName]||[],
        config.githubAuthData
    );
    await githubModule.register(apiProvider);
    await githubModule.setAutoRefresh((await getTargets(config)).filter(t=>t.autorefresh));

    const lightningModule = new LightningModule();
    await lightningModule.register(apiProvider);



}

main();