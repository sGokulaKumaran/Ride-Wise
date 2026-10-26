package vehicle.ridewise.dto;

import java.util.List;

// ============================================================
// AccountDtos — requests and answers of the account settings
// (password, email, other devices, delete account)
// ============================================================
public final class AccountDtos {

    private AccountDtos() {}

    /** Change the password: the current one proves it is really the owner. */
    public record PasswordChange(String currentPassword, String newPassword) {}

    /** Change the sign-in email; the password confirms it. */
    public record EmailChange(String email, String password) {}

    /** Delete the account: the password, and the word DELETE typed out. */
    public record DeleteAccount(String password, String confirm) {}

    public record OwnedOrganization(Long id, String name) {}

    /**
     * What stands in the way of deleting the account, and what will happen
     * on the way. canDelete is false while blockers remain.
     */
    public record DeleteCheck(
            boolean canDelete,
            List<OwnedOrganization> ownedOrganizations,
            boolean lastPlatformAdmin,
            long activeRides,
            boolean drivingNow) {}
}
