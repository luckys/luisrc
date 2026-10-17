BEGIN;
WITH accepted AS (
  INSERT INTO reliable_lab.inbox(consumer,event_id)
  VALUES ('notification-projection','e1')
  ON CONFLICT DO NOTHING
  RETURNING event_id
)
INSERT INTO reliable_lab.projection(operation_id,notifications)
SELECT 'o1',1 FROM accepted
ON CONFLICT (operation_id)
DO UPDATE SET notifications = reliable_lab.projection.notifications + 1;
COMMIT;
