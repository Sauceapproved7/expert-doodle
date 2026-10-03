import {buildCampaignPerformanceInput,evaluateCampaignPerformance,reviewPerformanceRecommendation,createPerformanceReviewReceipt} from '../performance-brain/core.mjs';

export function createMarketing16PerformanceBridge(){
  return Object.freeze({
    evaluate(pack,input={}){
      return evaluateCampaignPerformance(buildCampaignPerformanceInput(pack,input));
    },
    review(result,review={}){
      return reviewPerformanceRecommendation(result,review);
    },
    receipt(review,meta={}){
      return createPerformanceReviewReceipt(review,meta);
    },
    authority(){
      return Object.freeze({analysisAllowed:true,reviewAllowed:true,receiptAllowed:true,publishAllowed:false,spendAllowed:false,automaticMutation:false});
    }
  });
}
