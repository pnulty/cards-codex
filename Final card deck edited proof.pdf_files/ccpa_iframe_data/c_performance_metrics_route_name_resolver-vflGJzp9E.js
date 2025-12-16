!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="1ccb134a-7c34-3485-9da6-2168d3e157ef")}catch(e){}}();
define(["exports"],(function(e){"use strict";class t{constructor(e=(()=>{})){this._mapper=e}static getInstance(){return t._instance||(t._instance=new t),t._instance}static reset(){t._instance=new t}setMapper(e){this._mapper=e}resolve(){let e="";try{e=this._mapper(window.location)}catch(e){}return e||""}}t._instance=null;const n=t.getInstance();e.resolveRouteName=()=>n.resolve()}));
//# sourceMappingURL=c_performance_metrics_route_name_resolver.js-vflpoL_PL.map

//# debugId=1ccb134a-7c34-3485-9da6-2168d3e157ef