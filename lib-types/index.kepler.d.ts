import { type PurchaseFlow, type PurchaseFlowOptions, type PurchaseFlowPurchase } from './purchase-flow-core';
import { type IapkitConfirmationOptions } from './purchase-flow-confirmers';
import { type SdkPurchaseFlowOptions } from './utils/purchaseFlowBinding';
import type { MutationField, ProductQueryType, ProductRequest, Purchase, PurchaseError, PurchaseUpdatedListenerOptions, QueryField } from './types';
export * from './types';
export * from './vega';
export * from './useIAP';
export { kitApi, KitApiError, resolveLocalizedPayload } from './kit-api';
export type { EntitlementsResponse, KitApiOptions, KitClientPayloadCache, KitClientPayloadOptions, KitClientPayloadResponse, KitLocalizedClientPayload, KitLocalizedClientPayloadOptions, KitLocalizedPayloadOptions, KitProduct, KitProductClientPayload, KitProductOffer, KitProductPlatform, KitProductsOptions, KitProductsResponse, KitSubscription, StatusResponse, } from './kit-api';
export { describePurchaseFlowStatus, toPurchaseConfirmationRequest, } from './purchase-flow-core';
export type { PurchaseConfirmation, PurchaseConfirmationRequest, PurchaseFlow, PurchaseFlowGuidance, PurchaseFlowGuidanceKey, PurchaseFlowOptions, PurchaseFlowOutcome, PurchaseFlowPurchase, PurchaseFlowStatus, RecoverPurchasesOptions, } from './purchase-flow-core';
export type { IapkitConfirmationOptions } from './purchase-flow-confirmers';
export type { SdkPurchaseFlowOptions } from './utils/purchaseFlowBinding';
export declare enum OpenIapEvent {
    PurchaseUpdated = "purchase-updated",
    PurchaseError = "purchase-error",
    PromotedProductIOS = "promoted-product-ios",
    UserChoiceBillingAndroid = "user-choice-billing-android",
    DeveloperProvidedBillingAndroid = "developer-provided-billing-android",
    SubscriptionBillingIssue = "subscription-billing-issue"
}
export type ProductTypeInput = ProductQueryType;
export interface EventSubscription {
    remove(): void;
}
export declare const emitter: {
    addListener(eventName: OpenIapEvent, listener: (payload: Purchase | PurchaseError) => void): EventSubscription;
    removeListener(eventName: OpenIapEvent, listener: (payload: Purchase | PurchaseError) => void): void;
};
export declare const purchaseUpdatedListener: (listener: (event: Purchase) => void, options?: PurchaseUpdatedListenerOptions | null) => EventSubscription;
export declare const purchaseErrorListener: (listener: (error: PurchaseError) => void) => EventSubscription;
export declare const initConnection: MutationField<'initConnection'>;
export declare const endConnection: MutationField<'endConnection'>;
export declare const fetchProducts: (request: Omit<ProductRequest, "type"> & {
    type?: ProductTypeInput | null;
}) => ReturnType<QueryField<"fetchProducts">>;
export declare const requestPurchase: MutationField<'requestPurchase'>;
export declare const getAvailablePurchases: QueryField<'getAvailablePurchases'>;
export declare const finishTransaction: MutationField<'finishTransaction'>;
export declare const restorePurchases: MutationField<'restorePurchases'>;
export declare const getActiveSubscriptions: QueryField<'getActiveSubscriptions'>;
export declare const hasActiveSubscriptions: QueryField<'hasActiveSubscriptions'>;
export declare const getStorefront: QueryField<'getStorefront'>;
export declare const verifyPurchaseWithProvider: MutationField<'verifyPurchaseWithProvider'>;
export declare const verifyPurchase: MutationField<'verifyPurchase'>;
export declare const acknowledgePurchaseAndroid: MutationField<'acknowledgePurchaseAndroid'>;
export declare const consumePurchaseAndroid: MutationField<'consumePurchaseAndroid'>;
export declare const syncIOS: MutationField<'syncIOS'>;
export declare const verifyAppOwnership: QueryField<'verifyAppOwnership'>;
export declare const getAppTransactionIOS: QueryField<'getAppTransactionIOS'>;
export declare const getPromotedProductIOS: QueryField<'getPromotedProductIOS'>;
export declare const showManageSubscriptionsIOS: MutationField<'showManageSubscriptionsIOS'>;
export declare const presentExternalPurchaseLinkIOS: MutationField<'presentExternalPurchaseLinkIOS'>;
export declare const deepLinkToSubscriptions: MutationField<'deepLinkToSubscriptions'>;
export declare const openRedeemOfferCode: MutationField<'openRedeemOfferCode'>;
export declare const promotedProductListenerIOS: () => EventSubscription;
export declare const userChoiceBillingListenerAndroid: () => EventSubscription;
export declare const developerProvidedBillingListenerAndroid: () => EventSubscription;
export declare const subscriptionBillingIssueListener: () => EventSubscription;
export declare const isBillingProgramAvailableAndroid: MutationField<'isBillingProgramAvailableAndroid'>;
export declare const getBillingChoiceInfoAndroid: QueryField<'getBillingChoiceInfoAndroid'>;
export declare const launchExternalLinkAndroid: MutationField<'launchExternalLinkAndroid'>;
export declare const createBillingProgramReportingDetailsAndroid: MutationField<'createBillingProgramReportingDetailsAndroid'>;
export declare const showBillingProgramInformationDialogAndroid: MutationField<'showBillingProgramInformationDialogAndroid'>;
export declare const showInAppMessagesAndroid: MutationField<'showInAppMessagesAndroid'>;
/**
 * Creates the app's purchase flow on Amazon Vega. Create one per signed-in
 * account, dispose it when the account changes, and pass it to
 * `useIAP({purchaseFlow})`.
 * @see {@link https://kit.openiap.dev/docs/purchase-flow}
 */
export declare function createPurchaseFlow(options: SdkPurchaseFlowOptions): PurchaseFlow<Purchase>;
export declare function createPurchaseFlow<P extends PurchaseFlowPurchase>(options: PurchaseFlowOptions<P>): PurchaseFlow<P>;
/**
 * Confirms purchases with IAPKit from the app, for apps without a backend:
 * pass it as `confirmWithBackend` with a publishable key. Credit consumables
 * in `grant`, which runs before the purchase is consumed.
 */
export declare function confirmWithIapkit(options: IapkitConfirmationOptions<Purchase>): PurchaseFlowOptions<Purchase>['confirmWithBackend'];
//# sourceMappingURL=index.kepler.d.ts.map