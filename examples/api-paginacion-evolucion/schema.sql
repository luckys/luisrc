CREATE TABLE orders (
  id bigint PRIMARY KEY,
  tenant_id integer NOT NULL,
  status text NOT NULL CHECK (status IN ('paid', 'pending')),
  created_at timestamptz(3) NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency = 'EUR'),
  description text NOT NULL,
  search tsvector GENERATED ALWAYS AS (to_tsvector('spanish', description)) STORED
);

INSERT INTO orders (id, tenant_id, status, created_at, amount_minor, currency, description)
SELECT g, (g % 2 + 1)::integer,
       CASE WHEN g % 5 = 0 THEN 'pending' ELSE 'paid' END,
       timestamptz '2026-01-01 00:00:00+00' + (g / 10) * interval '1 millisecond',
       (g % 100000 + 1)::integer, 'EUR',
       CASE WHEN g % 97 = 0 THEN 'camara digital' ELSE 'libro de software' END
FROM generate_series(1, 1000000) AS g;

CREATE INDEX orders_page ON orders (tenant_id, status, created_at DESC, id DESC)
INCLUDE (amount_minor, currency, description);
CREATE INDEX orders_search ON orders USING gin (search);
