/** Published purchase shape; optional adapter evidence stays for compatibility. */
export interface PurchaseFlowPurchase {
    id: string;
    productId: string;
    purchaseState: string;
    purchaseToken?: string | null;
    store: string;
    storeId?: string | null;
    ids?: string[] | null;
    quantity?: number;
    isAcknowledgedAndroid?: boolean | null;
    /**
     * A requested plan change that has not applied yet: Google Play waits for
     * its payment, Amazon applies it at the next renewal.
     */
    pendingPurchaseUpdateAndroid?: {
        products: string[];
    } | null;
    /** Apple's `Sandbox` or `Production`, which a confirmer matches against its verdict. */
    environmentIOS?: string | null;
    /** The Amazon user the receipt belongs to, which Amazon RVS checks. */
    userIdAmazon?: string | null;
    revocationDateIOS?: number | null;
    isUpgradedIOS?: boolean | null;
    expirationDateIOS?: number | null;
}
/** Body the app sends its backend, which takes the user from its own session. */
export interface PurchaseConfirmationRequest {
    store: "apple" | "google";
    /** Apple JWS or Google Play purchase token, as the store issued it. */
    purchaseToken: string;
    /** The product the app expected, to compare with the store's answer. */
    productId: string;
}
/**
 * A confirmer's verdict on one purchase. Only `entitled` grants access;
 * `verified` and `linked` mean the purchase is valid but access is not granted
 * yet. `ownership_conflict` sets `alreadyGranted` when another account already
 * got access, which lets the app finish it. `invalid` and
 * `test_account_restricted` are settled rejections: return
 * `verification_delayed` for any answer that may still change.
 */
export type PurchaseConfirmation = {
    status: "store_pending";
} | {
    status: "verification_delayed";
    retryAfterMs: number;
} | {
    status: "ownership_conflict";
    alreadyGranted: boolean;
} | {
    status: "test_account_restricted";
} | {
    status: "invalid";
    reason?: string;
} | {
    status: "verified";
    retryAfterMs?: number;
} | {
    status: "linked";
    retryAfterMs?: number;
} | {
    status: "entitled";
    alreadyGranted: boolean;
};
type Finishable = "entitled" | "ownership_conflict" | "test_account_restricted";
/**
 * Where a purchase stands after the flow ran. `finishError` means finishing
 * failed and recovery retries it; an `entitled` status still grants access.
 * `changePending` marks an `entitled` purchase whose requested upgrade,
 * downgrade, or prepaid top-up has not applied yet (Google Play waits for its
 * payment, Amazon applies it at the next renewal): access stays on the current
 * plan. `recovered` marks an `invalid` purchase recovery found, not one the
 * user just bought.
 */
export type PurchaseFlowStatus = Exclude<PurchaseConfirmation, {
    status: Finishable | "invalid";
}> | (Extract<PurchaseConfirmation, {
    status: "entitled";
}> & {
    finishError?: unknown;
    changePending?: true;
}) | (Extract<PurchaseConfirmation, {
    status: "ownership_conflict" | "test_account_restricted";
}> & {
    finishError?: unknown;
}) | (Extract<PurchaseConfirmation, {
    status: "invalid";
}> & {
    finishError?: unknown;
    recovered?: true;
}) | {
    status: "failed";
    error: unknown;
};
export interface PurchaseFlowOutcome<P extends PurchaseFlowPurchase> {
    purchase: P;
    status: PurchaseFlowStatus;
}
export interface PurchaseFlowOptions<P extends PurchaseFlowPurchase> {
    /**
     * Confirms and grants access before returning `entitled`; the flow finishes
     * the purchase immediately after. Throws or timeouts leave it unfinished
     * for recovery. An app backend or any verification service can answer here.
     */
    confirmWithBackend: (purchase: P, context: {
        isConsumable: boolean;
    }) => Promise<PurchaseConfirmation>;
    /**
     * Milliseconds `confirmWithBackend` may take before the purchase ends as
     * `failed`, so a hung call cannot hold it for the session. Default 30000.
     */
    confirmTimeoutMs?: number;
    finishTransaction: (args: {
        purchase: P;
        isConsumable: boolean;
    }) => Promise<unknown>;
    /**
     * From the app's product config. On Android a wrong answer consumes a
     * non-consumable or blocks rebuying a consumable.
     */
    isConsumable: (productId: string) => boolean;
    getAvailablePurchases: () => Promise<P[]>;
    /**
     * The SDK's `getPendingTransactionsIOS` on iOS, `undefined` elsewhere: off
     * iOS an SDK may answer `[]`, which would hide unacknowledged Android
     * purchases.
     * Recovery reads unfinished StoreKit transactions, consumables included,
     * from it. If it throws, recovery confirms every Apple purchase
     * `getAvailablePurchases` lists instead.
     */
    getPendingTransactionsIOS: (() => Promise<P[]>) | undefined;
    /**
     * Registers for the store's purchase deliveries; the flow processes each one
     * until `dispose`. SDKs pass their purchase listener.
     */
    listenForPurchases?: (onPurchase: (purchase: P) => void) => {
        remove: () => void;
    };
    /**
     * Whether the user's own request produced a delivered purchase. Only then
     * may an `invalid` delivery offer buying again; without this, no delivery
     * the flow listened for does.
     */
    wasRequested?: (purchase: P) => boolean;
}
export interface RecoverPurchasesOptions {
    /** Also re-confirm purchases that were already finished, for a restore button. */
    includeFinished?: boolean;
}
export interface PurchaseFlow<P extends PurchaseFlowPurchase> {
    /**
     * Confirms one purchase the user just bought. Finishes it once access is
     * granted to this or another account, and a settled rejection on iOS only:
     * Google Play refunds a rejected purchase left unacknowledged, while iOS
     * would redeliver it forever.
     */
    processPurchase: (purchase: P) => Promise<PurchaseFlowStatus>;
    /**
     * Runs unfinished purchases (or every owned one) through the flow, one at a
     * time; a call made while a pass runs shares it. Throws if it meets an
     * Apple purchase without `getPendingTransactionsIOS`.
     */
    recoverPurchases: (options?: RecoverPurchasesOptions) => Promise<PurchaseFlowOutcome<P>[]>;
    /**
     * Calls `listener` with every outcome: once per confirmation, however many
     * deliveries shared it, and once per delivery of an already settled
     * purchase. Returns the function that unsubscribes it.
     */
    subscribe: (listener: (outcome: PurchaseFlowOutcome<P>) => void) => () => void;
    /**
     * Stops listening and publishing, and stops a recovery pass from confirming
     * anything more; confirmations already running still finish. Call it when
     * the signed-in account changes, then create the next account's flow.
     */
    dispose: () => void;
}
/**
 * How far a store's purchase time may trail the moment the app asked for it
 * and still count as that request: device clocks run ahead. A redelivered
 * receipt is far older.
 */
export declare const PURCHASE_REQUEST_CLOCK_SKEW_MS = 600000;
/**
 * Single-product, single-unit purchases only. Create one flow per
 * authenticated app account. Capture that session in confirmWithBackend and
 * dispose the flow after switching accounts.
 */
export declare function createPurchaseFlow<P extends PurchaseFlowPurchase>(options: PurchaseFlowOptions<P>): PurchaseFlow<P>;
/** Builds the backend request body; throws for a purchase without Apple or Google evidence. */
export declare function toPurchaseConfirmationRequest(purchase: PurchaseFlowPurchase): PurchaseConfirmationRequest;
export type PurchaseFlowGuidanceKey = "payment_pending" | "change_pending" | "verification_delayed" | "owned_by_another_account" | "test_purchase_not_accepted" | "purchase_not_valid" | "access_pending" | "access_granted" | "try_again_later";
/** Neutral guidance an app maps to its own copy. */
export interface PurchaseFlowGuidance {
    key: PurchaseFlowGuidanceKey;
    /**
     * True only for an `invalid` purchase the user just made. False whenever the
     * user may already have paid: never ask them to buy again.
     */
    offerPurchase: boolean;
    /** Earliest time to run the purchase through the flow again. */
    retryAfterMs?: number;
}
export declare function describePurchaseFlowStatus(status: PurchaseFlowStatus): PurchaseFlowGuidance;
export {};
//# sourceMappingURL=purchase-flow-core.d.ts.map