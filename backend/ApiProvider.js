//@ts-check


/**
 * @callback ApiAction
 * @param {string} data
 * @return {Promise<Object>} output
 */
export default class ApiProvider {
    /**
     * 
     * @param {string} path 
     * @param {ApiAction} action 
     * @returns {void}
     */
    registerApi(path, action) {

    }
}