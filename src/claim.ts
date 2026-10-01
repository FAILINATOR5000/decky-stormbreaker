type Claim = {
    owner: "stormbreaker";
    contract: number;
    version: string;
    stormbreaker: boolean;
    automaticRecovery: boolean;
};

type ClaimedFeature = "stormbreaker" | "automaticRecovery";

const CONTRACT = 1;

function claimWindow(): { __stormbreakerClaim?: Claim } {
    return window as unknown as { __stormbreakerClaim?: Claim };
}

function ownClaim(): Claim | null {
    const claim = claimWindow().__stormbreakerClaim;
    return claim?.owner === "stormbreaker" ? claim : null;
}

export function publishClaim(version: string, stormbreaker: boolean, automaticRecovery: boolean): void {
    claimWindow().__stormbreakerClaim = {
        owner: "stormbreaker",
        contract: CONTRACT,
        version,
        stormbreaker,
        automaticRecovery
    };
}

export function updateClaim(feature: ClaimedFeature, on: boolean): void {
    const claim = ownClaim();
    if (claim) {
        claim[feature] = on;
    }
}

export function withdrawClaim(): void {
    if (ownClaim()) {
        delete claimWindow().__stormbreakerClaim;
    }
}
