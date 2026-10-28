import type { PurchaseConfirmation, PurchaseFlowOptions, PurchaseFlowPurchase } from "./purchase-flow-core";
type IapkitStore = "apple" | "google" | "amazon" | "horizon";
/** How an app without its own backend confirms purchases with IAPKit. */
export interface IapkitConfirmationOptions<P extends PurchaseFlowPurchase = PurchaseFlowPurchase> {
    /**
     * A publishable key (`openiap-kit_pk_...`), which is safe to ship in an
     * app. Leave it out where the SDK has one configured, such as Expo's
     * `iapkitApiKey`.
     */
    apiKey?: string;
    /** A self-hosted or local IAPKit origin. Defaults to https://kit.openiap.dev. */
    baseUrl?: string;
    amazon?: {
        /** Verify App Tester receipts with the Amazon RVS Cloud Sandbox. */
        sandbox?: boolean;
        /** RVS reports a subscription term under its parent SKU; maps one to the other. */
        verifiedProductId?: (productId: string) => string;
    };
    /** The IAPKit store that verifies a community store's evidence, such as an Amazon RVS adapter. */
    verifyAs?: (purchase: P) => IapkitStore | undefined;
    /** Credits consumables before finishing; must be idempotent per purchase.id. */
    grant?: (purchase: P, context: {
        isConsumable: boolean;
    }) => Promise<void>;
}
/** @internal Use the SDK's VerifyPurchaseWithProviderProps. */
export interface IapkitVerificationProps {
    provider: "iapkit";
    iapkit: {
        apiKey?: string;
        baseUrl?: string;
        apple?: {
            jws: string;
        };
        google?: {
            purchaseToken: string;
        };
        amazon?: {
            receiptId: string;
            expectedProductId: string;
            sandbox: boolean;
            userId?: string;
        };
        horizon?: {
            sku: string;
        };
    };
}
/** @internal Use the SDK's VerifyPurchaseWithProviderResult. */
export interface IapkitVerificationResult {
    iapkit?: {
        store: string;
        storeId: string;
        environment?: string | null;
        isValid: boolean;
        state: string;
        productId?: string | null;
    } | null;
    errors?: {
        code?: string | null;
        message: string;
    }[] | null;
}
/**
 * @internal Use the SDK's confirmWithIapkit.
 * The SDK's `confirmWithIapkit`, given its `verifyPurchaseWithProvider`:
 * verifies the purchase with IAPKit, then runs `grant` before the flow
 * finishes it.
 */
export declare function createIapkitConfirmation<P extends PurchaseFlowPurchase>(verifyPurchaseWithProvider: (props: IapkitVerificationProps) => Promise<IapkitVerificationResult>, options: IapkitConfirmationOptions<P>): PurchaseFlowOptions<P>["confirmWithBackend"];
/**
 * @internal Use the SDK's confirmOnDeviceIOS.
 * The SDK's `confirmOnDeviceIOS`, given its `getPendingTransactionsIOS`, for an
 * app with neither a backend nor IAPKit. StoreKit verified the transaction if
 * it is still unfinished, unrevoked, not upgraded, unexpired, and from the
 * purchase's environment; `grant` then runs before the flow finishes it.
 */
export declare function createDeviceConfirmationIOS<P extends PurchaseFlowPurchase>(getPendingTransactionsIOS: () => Promise<P[]>, options?: {
    /** Required for consumables; credit each purchase.id only once. */
    grant?: (purchase: P, context: {
        isConsumable: boolean;
    }) => Promise<void>;
}): PurchaseFlowOptions<P>["confirmWithBackend"];
/** @internal Builds the IAPKit request; throws for a store IAPKit cannot verify. */
export declare function toIapkitVerificationProps<P extends PurchaseFlowPurchase>(purchase: P, options: IapkitConfirmationOptions<P>): IapkitVerificationProps;
/**
 * @internal Use the SDK's confirmWithIapkit.
 * Turns IAPKit's answer into the flow's confirmation. Anything that may be a
 * configuration error rather than a rejected payment throws, so the flow
 * reports `failed` and leaves the purchase unfinished: evidence for another
 * store, product, or environment, `inauthentic` (IAPKit's answer to a product
 * or package mismatch, and to every Horizon rejection), and a valid state this
 * product type cannot be granted from.
 */
export declare function readIapkitVerification<P extends PurchaseFlowPurchase>(result: IapkitVerificationResult, purchase: P, context: {
    isConsumable: boolean;
}, options?: Omit<IapkitConfirmationOptions<P>, "apiKey">): PurchaseConfirmation;
export {};
//# sourceMappingURL=purchase-flow-confirmers.d.ts.map