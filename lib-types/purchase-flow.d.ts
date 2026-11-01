import type { PurchaseFlowPurchase, PurchaseFlowOptions, PurchaseConfirmation } from './purchase-flow-core';
import { type IapkitConfirmationOptions as ConfirmationOptions, type IapkitVerificationProps as VerificationProps, type IapkitVerificationResult as VerificationResult } from './purchase-flow-confirmers';
export * from './purchase-flow-core';
/** @deprecated Use the SDK's IapkitConfirmationOptions. Removed in the next major release. */
export interface IapkitConfirmationOptions<P extends PurchaseFlowPurchase = PurchaseFlowPurchase> extends ConfirmationOptions<P> {
}
/** @deprecated Use the SDK's VerifyPurchaseWithProviderProps. Removed in the next major release. */
export interface IapkitVerificationProps extends VerificationProps {
}
/** @deprecated Use the SDK's VerifyPurchaseWithProviderResult. Removed in the next major release. */
export interface IapkitVerificationResult extends VerificationResult {
}
/** @deprecated Use the SDK's confirmWithIapkit. Removed in the next major release. */
export declare function createIapkitConfirmation<P extends PurchaseFlowPurchase>(verify: (props: IapkitVerificationProps) => Promise<IapkitVerificationResult>, options: IapkitConfirmationOptions<P>): PurchaseFlowOptions<P>['confirmWithBackend'];
/** @deprecated Use the SDK's confirmOnDeviceIOS. Removed in the next major release. */
export declare function createDeviceConfirmationIOS<P extends PurchaseFlowPurchase>(getPendingTransactionsIOS: () => Promise<P[]>, options?: {
    grant?: (purchase: P, context: {
        isConsumable: boolean;
    }) => Promise<void>;
}): PurchaseFlowOptions<P>['confirmWithBackend'];
/** @deprecated Use the SDK's confirmWithIapkit. Removed in the next major release. */
export declare function toIapkitVerificationProps<P extends PurchaseFlowPurchase>(purchase: P, options: IapkitConfirmationOptions<P>): IapkitVerificationProps;
/** @deprecated Use the SDK's confirmWithIapkit. Removed in the next major release. */
export declare function readIapkitVerification<P extends PurchaseFlowPurchase>(result: IapkitVerificationResult, purchase: P, context: {
    isConsumable: boolean;
}, options?: Omit<IapkitConfirmationOptions<P>, 'apiKey'>): PurchaseConfirmation;
//# sourceMappingURL=purchase-flow.d.ts.map