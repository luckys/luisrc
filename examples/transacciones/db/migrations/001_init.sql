CREATE TABLE orders (
  id uuid PRIMARY KEY,
  total_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'created'
);

CREATE TABLE payments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'created'
);
