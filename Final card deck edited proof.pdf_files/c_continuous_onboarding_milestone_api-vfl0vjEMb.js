!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d4c48921-861f-3751-b1d5-cc7b06876458")}catch(e){}}();
define(["exports","./e_ui_page_files_router"],(function(e,t){"use strict";const s=(e,s)=>{const n=new t.DefaultUserApiV2Client(e);t.GetContinuousOnboardingRoutes(n).rpc("milestone/set_complete",{milestones:s},{})};e.markMilestoneAsCompleted=(e,t)=>{s(e,[t])}}));
//# sourceMappingURL=c_continuous_onboarding_milestone_api.js-vflu48qfo.map

//# debugId=d4c48921-861f-3751-b1d5-cc7b06876458