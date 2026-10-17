BEGIN;
INSERT INTO reliable_lab.operations(id,amount_minor,currency,state)
VALUES ('o1',1200,'EUR','processing');
INSERT INTO reliable_lab.idempotency(scope,key,fingerprint,operation_id)
VALUES ('tenant:a:create','key1','EUR:1200','o1');
INSERT INTO reliable_lab.outbox(id,operation_id,type)
VALUES ('e1','o1','operation.processing');
COMMIT;
