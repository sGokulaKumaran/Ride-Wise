package vehicle.ridewise.service;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

// Runs something only once the surrounding database transaction has
// committed — so a live event, a cache refresh or a notification can never
// describe a change that was rolled back, and a client that reacts at once
// always reads the new state. Without a transaction it runs straight away.
final class Tx {

    private Tx() {}

    static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
