Frequently Asked Questions
==========================

This is a list of frequently asked questions relating to storage engines, nearly
all of which come from the mongodb-dev Google group. Many of the categories
overlap, so please do not pay too much attention to the section titles. 

Storage Engine API
------------------
**Q**: On InnoDB, row locks are not released until log sync is done. Will that be a
problem in the API?  
**A**: It’s not a problem with the API. A storage engine
implementation could log sync at the end of every unit of work. The exact
behavior depends on the durability behavior of the storage engine
implementation.

**Q**: As far as I can tell, the storage engine API allows storage engines to keep
some context in the OperationContext's RecoveryUnit, but only for updates (there
is no beginUnitOfWork equivalent for queries). This is presumably because of the
history of locking inside MongoDB, but to prepare for future storage engines, it
would be helpful to have some context that the storage engine can track across
related read operations.  
**A**: We agree that it would be helpful. We haven’t gotten to this yet because our
current storage engine and isolation level don’t require this. Feel encouraged
to suggest details.

**Q**: Does the API expect committed changes from a transaction to be visible to
others before log sync?  
**A**: The API does not require that a commit of a unit of work implies log sync.
 Changes should only be visible to the operation making the changes until those
changes are committed, at which point the changes should be visible to all
clients of the storage engine.

Operation Context
-----------------
**Q**: I didn't find documentation for the transaction API, nor source code for it.
How can I find the information for it?  
**A**: You can find the documentation and source code for this in
src/mongo/db/operation_context.h and src/mongo/db/operation_context_impl.cpp,
respectively.  OperationContext contains many classes, in particular LockState
and RecoveryUnit, which have their own definitions.

**Q**: In the RecordStore::getIterator() interface, the first parameter is a
OperationContext "txn". I didn't find any documentation about how this context
should be used by a specific storage implementation. I don't find it used in
rocks implementation, nor heap1 or mmap_v1. How can I find answer to this
question?  
**A**: OperationContext is all of the state for an operation: the locks, the client
information, the recovery unit, etc.  In particular, a record store
implementation would probably access the lock state and the recovery unit.
 Storage engines are free to do whatever they need to with the OperationContext
in order to satisfy the storage APIs.

Reading & Writing
-----------------
**Q**: Are write cursors expected to see their changes in progress? This could be an
issue for InnoDB write batching as done by RocksDB (call multi-put on commit)
doesn't have to be done. Where RocksDB engine adds to a write batch, InnoDB
could immediately apply the change to an uncommitted transaction.  
**A**: Yes, this is expected. There has been some discussion about removing this
requirement. For now, however, we are not planning on doing so. Instead, a
queryable and iterable WriteBatch class is being created to allow access to data
which has not yet been committed.

**Q**: "Read-your-writes" consistency was mentioned in Mathias's MongoWorld
presentation, but as far as I can see, the storage engine has no way to connect
a RecordStore::insertRecord call with a subsequent RecordStore::dataFor -- the
latter doesn't take an OperationContext.  Is this an oversight?  
**A**: Yes, this is an oversight.  We’ll be doing a sweep through and fixing this
and other problems.  (FYI, as an implementation side-effect, mmapv1
automatically provides read-your-writes, which partially explains this
oversight.)

Q. Storage engines need to support a "read-your-own-update.”  In the storage
engine interface, which parameter/variable passes this transaction/session
information?  
**A**: The OperationContext “txn”, which is also called “opCtx” in some areas, has
the information.  There are probably some places we have neglected to pass this
in.

**Q**: When executing a query, if both of indexes ("btree") and record store are
read, how do we make sure we are reading from a consistent view of them (RocksDB
or other storage)? I didn't find any handling of that from the codes. Can you
point me in a direction to look for this?  
**A**: We do not handle this now, because it is not an issue with our current
(mmapv1) storage engine. We’re discussing how to solve this. We currently store
the information necessary to obtain a consistent view of the database in the
RocksRecoveryUnit class, which is itself a member of the OperationContext class.
Therefore, one possible solution would be to pass the OperationContext class to
every method which needs a consistent view of the database. We will soon merge
code which has comments mentioning every instance in rocks where this needs to
be done.

RecoveryUnit
------------
**Q**: Should RecoveryUnit::syncDataAndTruncateJournal, RecoveryUnit::commitIfNeeded
and RecoveryUnit::isCommitNeeded be static or in a different class? I am not
sure why they need to effect the instance of RecoveryUnit?  
**A**: These methods are effectively static in that they will only modify global
state. However, these methods are virtual, which is why we aren’t declaring them
as static. That being said, we will likely remove this methods from the public
API and move them into our mmapv1 storage engine implementation in the near
future.

**Q**: RecoveryUnit::syncDataAndTruncateJournal sounds like a checkpoint. That can
take a long time, is this expected to block until that is done?  
**A**: Yes. Note that this is only called externally when we drop a database or when
the user explicitly requests a sync via the fsync command.  We may rename this
method as part of a naming sweep. 

**Q**: I didn't see where RecoveryUnit::isCommitNeeded() is called and couldn't
figure out how it is supposed to be used. What other handling we can possibly do
other than issuing RecoveryUnit::commitIfNeeded()?  
**A**: This will soon be removed from the API.

**Q**: RecoveryUnit::commitIfNeeded, RecoveryUnit::isCommitNeeded - I assume this
could be used to implement the InnoDB feature to force the log once per second  
**A**: It’s used internally by the record store in mmapv1. We’ll soon make it
private to DurRecoveryUnit and then remove it from the API. Ditto for various
writingPtr methods.

**Q**: As documented I don’t understand the point of the RecoverUnit::endUnitOfWork
nesting behavior. Can you explain where it is used or will be used?  
**A**: The RecoveryUnit interface and the mmapv1 (current mongodb storage engine)
implementation are both works in progress :)  We’re currently adding unit of
work declarations and two phase locking.  The nesting behavior currently exists
to verify that we’re adding units of work correctly and we expect to remove it
when two phase locking is completed.

**Q**: RecoveryUnit::{beginUnitOfWork, endUnitOfWork, commitUnitOfWork} - these
return nothing. What happens on failure? With optimistic concurrency control
commit can fail in the normal case. In theory, someone might try to use
optimistic CC for a RocksDB+Mongo engine.  
**A**: We’re currently not planning these interfaces with OCC (or MVCC) in mind.
 Currently, if any of these fooUnitOfWork functions fail, we expect to roll back
and probably retry the operation. The interfaces are rather fluid right now and
will probably return a Status (or throw an exception) at some point. However,
rollback should never fail.

**Q**: RecoveryUnit::commitIfNeeded() has a return value, but I didn't find codes
where return value is used. What does false suppose to mean?  Does it mean I/O
failure, wait to succeed, or wait to retry?  In general, in my understanding,
RecoveryUnit::commitIfNeeded() is supposed to write out some partial data to
transactional logs. If that's the case, maybe in
RocksRecoveryUnit::commitIfNeeded(), we should call the write option that
doesn't force fsync when writing to WAL, while in the final commit, force the
WAL sync.  
**A**: We’ll be removing commitIfNeeded from the public API.  It’s used by mmapv1
internally.

RocksDB
-------
**Q**: I think RocksRecoveryUnit::awaitCommit should remain in RecoveryUnit but be
renamed to ::awaitLogSync. If force log once per second is done, then this
blocks until the next commitIfNeededCall. But I think we [should] be explicit
about "commit" vs "forcing redo log to storage" given that many engines
including InnoDB, RocksDB & MongoDB let commit get done without a log force.  
**A**: We agree that these should be two separately defined pieces of functionality.
We’re currently discussing whether or not to expose the “forcing redo log to
storage” in the API. We also are planning on doing a renaming pass.

**Q**: Why doesn't RocksRecoveryUnit::endUnitOfWork respect _defaultCommit before
calling commitUnitOfWork?  
**A**: _defaultCommit is a temporary boolean that should disappear once we’ve fully
implemented rollbacks.

**Q**: Why is RocksRecoveryUnit::isCommitNeeded based on size of buffered write
batch? Isn't this supposed to return TRUE If a WAL sync is needed?  
**A**: This is an mmapv1-specific method that will be going away.  It’s part of the
API but will be removed soon.

**Q**: In RocksRecordStore::updateWithDamages() there is a comment "todo: this
should use the merge functionality in rocks". Can you explain more about the
motivation? Is it for atomicity, or for reducing write amplification?  
**A**: We want to do this for speed, as it will allow us to avoid reading in data
from rocks, updating it in memory, and writing it back. However, due to the way
the rest of our code works, we’re not sure if this will yield much of a
performance increase. For now, we’re focusing on getting minimal functionality
working, but may benchmark this in the future.

**Q**: How do I install RocksDB?  
**A**: https://groups.google.com/forum/#!topic/mongodb-dev/ilcHAg6JgQI

General
=======
**Q**: Does the storage engine allow for group commit?  
**A**: Yes.  In fact, the mmapv1 impl does group commit.

**Q**: cleanShutdown has no return value. What is to be done on an internal error
(assert & crash)?  
**A**: Yes, on internal error, assert and crash.

**Q**: Storage engine initialization is done in the constructor. How are errors on
init to be returned or handled?  
**A**: Currently all errors on storage engine init are fatal.  We assume if the
storage engine can’t work, the database probably can’t work either.

**Q**: Is Command::runAgainstRegistered() the entry point of query and update
queries? I saw these lines:

    OperationContext* noTxn = NULL; // mongos doesn't use transactions SERVER-13931
    execCommandClientBasic(noTxn, c, *client, queryOptions, ns, jsobj, anObjBuilder, false);

Are we always passing noTxn to the query? What does it mean?  
**A**: The entry point of query and updates is assembleResponse in instance.cpp.  In
the case you cite, the command is being invoked from mongos, which doesn’t need
to pay attention to durability or take locks.

**Q**: From my reading of the codes, the Cloner component is the way for MongoDB to
build a new slave from a master (called by ReplSource::resync()). If I
understand the codes correctly, cloning always does logical copy of keys
(reading keys one by one and insert them one by one). Two comments I have:

    1. RocksDB uses LSM, which provides a good feature that you can do physical copy
       of the files, which should be faster. Is there a long term plan to make
       use of it?   
    2. If we stick on logical copy, the best practice is to tune the RocksDB in 
       the new slave side to speed up the copy process:   
            1. Disable WAL tune compactions  
            2. Tune compaction to never happen   
            3. Use vectorrep mem table   
            4. Issue a full compaction and reopen the DB after cloning finishes.  
We might consider to design the storage plug-in and components to use it to be  
flexible enough to make it easy to make those future improvements when needed.  
**A**: Offering a physical file copy for initial sync is something we're
considering for the future, but not at this time.

