-- ===== Pengguna =====
CREATE TABLE users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      varchar(50)  NOT NULL UNIQUE,
  password_hash varchar(100) NOT NULL,
  full_name     varchar(100) NOT NULL,
  role          varchar(20)  NOT NULL CHECK (role IN ('OPERATOR', 'SUPERVISOR')),
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- ===== Produk =====
CREATE TABLE products (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku        varchar(50)  NOT NULL UNIQUE CHECK (sku = upper(sku)),   -- FR-12
  name       varchar(150) NOT NULL,
  unit       varchar(20)  NOT NULL,
  created_by integer      NOT NULL REFERENCES users(id),
  created_at timestamptz  NOT NULL DEFAULT now()
);

-- ===== Dokumen penerimaan =====
CREATE SEQUENCE receiving_document_number_seq;

CREATE TABLE receiving_documents (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doc_number    varchar(30)  NOT NULL UNIQUE,                         -- FR-24
  supplier_name varchar(150) NOT NULL,
  expected_date date         NOT NULL,
  notes         varchar(500),
  status        varchar(20)  NOT NULL DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_by    integer      NOT NULL REFERENCES users(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  submitted_by  integer REFERENCES users(id),
  submitted_at  timestamptz,
  completed_by  integer REFERENCES users(id),
  completed_at  timestamptz,
  cancelled_by  integer REFERENCES users(id),
  cancelled_at  timestamptz,
  cancel_reason varchar(500),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_completed_has_time CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL),
  CONSTRAINT chk_cancelled_has_reason CHECK (status <> 'CANCELLED' OR cancel_reason IS NOT NULL)
);
CREATE INDEX idx_receiving_documents_created ON receiving_documents (created_at DESC, id DESC);
CREATE INDEX idx_receiving_documents_status  ON receiving_documents (status, created_at DESC);

CREATE TABLE receiving_items (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id  integer     NOT NULL REFERENCES receiving_documents(id),
  product_id   integer     NOT NULL REFERENCES products(id),
  expected_qty integer     NOT NULL CHECK (expected_qty BETWEEN 1 AND 1000000),
  received_qty integer     NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_receiving_items_document_product UNIQUE (document_id, product_id),  -- BR-05
  CONSTRAINT uq_receiving_items_id_product UNIQUE (id, product_id),                  -- target FK komposit
  CONSTRAINT chk_received_not_exceed_expected CHECK (received_qty <= expected_qty)    -- BR-01
);
CREATE INDEX idx_receiving_items_product ON receiving_items (product_id);

-- ===== Receipt (satu kedatangan) =====
CREATE SEQUENCE receipt_number_seq;

CREATE TABLE receipts (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_number  varchar(30)  NOT NULL UNIQUE,                       -- FR-31
  document_id     integer      NOT NULL REFERENCES receiving_documents(id),
  idempotency_key varchar(100) NOT NULL UNIQUE,                       -- BR-07
  request_hash    char(64)     NOT NULL,                              -- FR-33
  notes           varchar(500),
  received_by     integer      NOT NULL REFERENCES users(id),
  received_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_receipts_document ON receipts (document_id);

-- ===== Stok =====
CREATE TABLE inventory_balances (
  product_id  integer     PRIMARY KEY REFERENCES products(id),
  on_hand_qty integer     NOT NULL DEFAULT 0 CHECK (on_hand_qty >= 0),  -- BR-09
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_transactions (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id        integer     NOT NULL REFERENCES products(id),
  type              varchar(20) NOT NULL CHECK (type IN ('RECEIPT')),
  quantity          integer     NOT NULL CHECK (quantity > 0),
  balance_after     integer     NOT NULL CHECK (balance_after >= 0),
  receipt_id        integer     NOT NULL REFERENCES receipts(id),
  receiving_item_id integer     NOT NULL,
  created_by        integer     NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_transactions_receipt_item UNIQUE (receipt_id, receiving_item_id),
  -- product_id wajib sama dengan produk milik item (lihat 3.3)
  CONSTRAINT fk_transactions_item_product FOREIGN KEY (receiving_item_id, product_id)
    REFERENCES receiving_items (id, product_id)
);
CREATE INDEX idx_transactions_created ON inventory_transactions (created_at DESC, id DESC);
CREATE INDEX idx_transactions_product ON inventory_transactions (product_id, created_at DESC);

-- Transaksi stok tidak boleh diubah atau dihapus (NFR-06)
CREATE FUNCTION forbid_transaction_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory_transactions bersifat append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_transactions_append_only
  BEFORE UPDATE OR DELETE ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_transaction_change();