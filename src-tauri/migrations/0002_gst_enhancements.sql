-- ============================================================
-- ORION Database Migration 0002: GST Enhancements
-- 
-- 1. Adds Shipping Address to Invoices
-- 2. Adds Vehicle and Transporter Details to Invoices
-- 3. Adds Freight and Additional Charges to Invoices
-- 4. Creates HSN & SAC Directory with Standard Indian GST Codes
-- ============================================================

-- Invoices: Shipping Address Fields
ALTER TABLE invoices ADD COLUMN shipping_name TEXT;
ALTER TABLE invoices ADD COLUMN shipping_address TEXT;
ALTER TABLE invoices ADD COLUMN shipping_city TEXT;
ALTER TABLE invoices ADD COLUMN shipping_state TEXT;
ALTER TABLE invoices ADD COLUMN shipping_state_code TEXT;
ALTER TABLE invoices ADD COLUMN shipping_pin TEXT;

-- Invoices: Transport and Vehicle Details
ALTER TABLE invoices ADD COLUMN vehicle_number TEXT;
ALTER TABLE invoices ADD COLUMN transport_mode TEXT DEFAULT 'Road';
ALTER TABLE invoices ADD COLUMN transporter_name TEXT;
ALTER TABLE invoices ADD COLUMN transporter_id TEXT;
ALTER TABLE invoices ADD COLUMN lr_rr_number TEXT;
ALTER TABLE invoices ADD COLUMN lr_rr_date TEXT;

-- Invoices: Additional Freight & Charges (in paise)
ALTER TABLE invoices ADD COLUMN shipping_charges INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN additional_charges INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN additional_charges_label TEXT DEFAULT 'Other Charges';

-- ============================================================
-- HSN / SAC DIRECTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS hsn_directory (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'GOODS' (HSN) or 'SERVICES' (SAC)
  category TEXT NOT NULL,       -- Sector/Industry
  description TEXT NOT NULL,
  default_gst_rate INTEGER NOT NULL, -- basis points (500=5%, 1200=12%, 1800=18%, 2800=28%)
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hsn_code ON hsn_directory(code);
CREATE INDEX IF NOT EXISTS idx_hsn_category ON hsn_directory(category);
CREATE INDEX IF NOT EXISTS idx_hsn_desc ON hsn_directory(description);

-- ============================================================
-- PRE-SEED STANDARD INDIAN GST HSN & SAC CODES
-- ============================================================

-- 1. Electronics & Information Technology
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('hsn_8517', '8517', 'GOODS', 'Electronics & IT', 'Mobile Phones, Smartphones, Telephones & Network Gear', 1800, datetime('now')),
('hsn_8471', '8471', 'GOODS', 'Electronics & IT', 'Laptops, Desktop Computers, Servers & Storage Units', 1800, datetime('now')),
('hsn_8528', '8528', 'GOODS', 'Electronics & IT', 'Monitors, Smart TVs & Video Projectors', 1800, datetime('now')),
('hsn_8504', '8504', 'GOODS', 'Electronics & IT', 'Power Adapters, Chargers, Inverters & Transformers', 1800, datetime('now')),
('hsn_8544', '8544', 'GOODS', 'Electronics & IT', 'Insulated Cables, Wires, HDMI & USB Cables', 1800, datetime('now')),
('hsn_8525', '8525', 'GOODS', 'Electronics & IT', 'CCTV Cameras, Surveillance Equipment & Digital Cameras', 1800, datetime('now')),
('hsn_8443', '8443', 'GOODS', 'Electronics & IT', 'Printers, Photocopiers, Multi-function Machines & Cartridges', 1800, datetime('now')),
('hsn_8518', '8518', 'GOODS', 'Electronics & IT', 'Headphones, Microphones, Speakers & Audio Amplifiers', 1800, datetime('now')),
('hsn_8523', '8523', 'GOODS', 'Electronics & IT', 'Pen Drives, SSDs, Hard Disks & Memory Cards', 1800, datetime('now')),
('hsn_8536', '8536', 'GOODS', 'Electronics & IT', 'Electrical Switches, MCBs, Plugs, Sockets & Relays', 1800, datetime('now'));

-- 2. Textiles, Apparel & Fashion
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('hsn_5208', '5208', 'GOODS', 'Textiles & Apparel', 'Cotton Fabrics, Handloom & Mill Cotton Cloth', 500, datetime('now')),
('hsn_6109', '6109', 'GOODS', 'Textiles & Apparel', 'T-Shirts, Polo Shirts, Singlets & Knitted Garments', 1200, datetime('now')),
('hsn_6203', '6203', 'GOODS', 'Textiles & Apparel', 'Men Suits, Trousers, Blazers, Shirts & Jeans', 1200, datetime('now')),
('hsn_6204', '6204', 'GOODS', 'Textiles & Apparel', 'Women Dresses, Sarees, Kurtis, Suits & Salwars', 1200, datetime('now')),
('hsn_6403', '6403', 'GOODS', 'Textiles & Apparel', 'Leather Footwear, Formal Shoes & Casual Shoes', 1200, datetime('now')),
('hsn_6402', '6402', 'GOODS', 'Textiles & Apparel', 'Sports Shoes, Slippers, Sandals & Rubber Footwear', 1200, datetime('now')),
('hsn_6302', '6302', 'GOODS', 'Textiles & Apparel', 'Bed Sheets, Blankets, Curtains & Table Linen', 1200, datetime('now')),
('hsn_4202', '4202', 'GOODS', 'Textiles & Apparel', 'Bags, Backpacks, Luggage Trolleys & Wallets', 1800, datetime('now'));

-- 3. Groceries, Food & FMCG
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('hsn_1006', '1006', 'GOODS', 'Groceries & Food', 'Rice (Basmati, Sona Masoori, Parboiled Rice)', 500, datetime('now')),
('hsn_1001', '1001', 'GOODS', 'Groceries & Food', 'Wheat, Atta, Maida & Semolina (Suji)', 500, datetime('now')),
('hsn_0713', '0713', 'GOODS', 'Groceries & Food', 'Pulses (Toor Dal, Moong Dal, Chana Dal, Urad Dal)', 500, datetime('now')),
('hsn_0902', '0902', 'GOODS', 'Groceries & Food', 'Tea (CTC, Green Tea, Flavored Tea Leaves)', 500, datetime('now')),
('hsn_0901', '0901', 'GOODS', 'Groceries & Food', 'Coffee Beans, Ground Coffee & Instant Coffee', 500, datetime('now')),
('hsn_1512', '1512', 'GOODS', 'Groceries & Food', 'Edible Cooking Oil (Sunflower, Mustard, Soybean Oil)', 500, datetime('now')),
('hsn_1701', '1701', 'GOODS', 'Groceries & Food', 'Refined Sugar, Brown Sugar & Gur (Jaggery)', 500, datetime('now')),
('hsn_0910', '0910', 'GOODS', 'Groceries & Food', 'Spices (Turmeric, Chilli, Coriander, Garam Masala)', 500, datetime('now')),
('hsn_1905', '1905', 'GOODS', 'Groceries & Food', 'Biscuits, Cookies, Bread, Rusks & Pastries', 1800, datetime('now')),
('hsn_2106', '2106', 'GOODS', 'Groceries & Food', 'Namkeen, Potato Chips, Sweets & Food Supplements', 1200, datetime('now')),
('hsn_2202', '2202', 'GOODS', 'Groceries & Food', 'Carbonated Soft Drinks, Energy Drinks & Fruit Juices', 2800, datetime('now')),
('hsn_0402', '0402', 'GOODS', 'Groceries & Food', 'Milk Powder, Condensed Milk, Ghee & Paneer', 1200, datetime('now'));

-- 4. Hardware, Paints & Construction
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('hsn_2523', '2523', 'GOODS', 'Hardware & Construction', 'Cement (Portland, Pozzolana, White Cement)', 2800, datetime('now')),
('hsn_7214', '7214', 'GOODS', 'Hardware & Construction', 'TMT Steel Bars, Iron Rods & Structural Steel', 1800, datetime('now')),
('hsn_3208', '3208', 'GOODS', 'Hardware & Construction', 'Paints, Enamels, Varnishes & Primer', 1800, datetime('now')),
('hsn_6907', '6907', 'GOODS', 'Hardware & Construction', 'Ceramic Floor & Wall Tiles, Vitrified Tiles', 1800, datetime('now')),
('hsn_3917', '3917', 'GOODS', 'Hardware & Construction', 'PVC Pipes, CPVC Plumbing Pipes & Fittings', 1800, datetime('now')),
('hsn_8301', '8301', 'GOODS', 'Hardware & Construction', 'Padlocks, Door Locks, Keys & Hardware Hinges', 1800, datetime('now')),
('hsn_6910', '6910', 'GOODS', 'Hardware & Construction', 'Sanitaryware, Wash Basins, Toilets & Ceramic Sinks', 1800, datetime('now')),
('hsn_8481', '8481', 'GOODS', 'Hardware & Construction', 'Taps, Cocks, Valves & Faucets for Plumbing', 1800, datetime('now')),
('hsn_7318', '7318', 'GOODS', 'Hardware & Construction', 'Screws, Bolts, Nuts, Rivets & Washers', 1800, datetime('now')),
('hsn_4412', '4412', 'GOODS', 'Hardware & Construction', 'Plywood, Blockboards & Laminated Wood Sheets', 1800, datetime('now'));

-- 5. Personal Care & Cosmetics
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('hsn_3401', '3401', 'GOODS', 'Personal Care & Hygiene', 'Bath Soaps, Liquid Handwash & Organic Cleansers', 1800, datetime('now')),
('hsn_3305', '3305', 'GOODS', 'Personal Care & Hygiene', 'Shampoo, Hair Oil, Conditioner & Hair Creams', 1800, datetime('now')),
('hsn_3306', '3306', 'GOODS', 'Personal Care & Hygiene', 'Toothpaste, Tooth Powder, Mouthwash & Floss', 1800, datetime('now')),
('hsn_3402', '3402', 'GOODS', 'Personal Care & Hygiene', 'Detergent Powder, Dishwash Bar & Cleaning Liquids', 1800, datetime('now')),
('hsn_3304', '3304', 'GOODS', 'Personal Care & Hygiene', 'Face Creams, Lotions, Sunscreen & Makeup Products', 1800, datetime('now')),
('hsn_3303', '3303', 'GOODS', 'Personal Care & Hygiene', 'Perfumes, Deodorants, Body Sprays & Colognes', 1800, datetime('now'));

-- 6. Pharmaceuticals & Healthcare
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('hsn_3004', '3004', 'GOODS', 'Pharmaceuticals & Health', 'Allopathic Medicines, Tablets, Syrups & Antibiotics', 1200, datetime('now')),
('hsn_3003', '3003', 'GOODS', 'Pharmaceuticals & Health', 'Ayurvedic, Homeopathic & Unani Medicines', 1200, datetime('now')),
('hsn_3005', '3005', 'GOODS', 'Pharmaceuticals & Health', 'Bandages, Cotton Gauze, Adhesive Plasters & First Aid', 1200, datetime('now')),
('hsn_9018', '9018', 'GOODS', 'Pharmaceuticals & Health', 'Medical Instruments, Syringes, BP Monitors & Oximeters', 1200, datetime('now')),
('hsn_3002', '3002', 'GOODS', 'Pharmaceuticals & Health', 'Vaccines, Serums, Blood Fractions & Cultures', 500, datetime('now'));

-- 7. Automobile & Auto Spare Parts
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('hsn_8711', '8711', 'GOODS', 'Automobiles & Spares', 'Motorcycles, Scooters & Two-Wheeled Motor Vehicles', 2800, datetime('now')),
('hsn_8708', '8708', 'GOODS', 'Automobiles & Spares', 'Auto Spare Parts, Brakes, Clutches & Gear Boxes', 2800, datetime('now')),
('hsn_8507', '8507', 'GOODS', 'Automobiles & Spares', 'Automobile Batteries, Lead-Acid Accumulators', 2800, datetime('now')),
('hsn_4011', '4011', 'GOODS', 'Automobiles & Spares', 'Pneumatic Rubber Tyres for Bikes, Cars & Trucks', 2800, datetime('now')),
('hsn_2710', '2710', 'GOODS', 'Automobiles & Spares', 'Engine Oil, Lubricants, Brake Fluid & Grease', 1800, datetime('now'));

-- 8. Stationery, Packaging & Office Supplies
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('hsn_4820', '4820', 'GOODS', 'Stationery & Packaging', 'Exercise Books, Registers, Note Pads & Diaries', 1200, datetime('now')),
('hsn_4819', '4819', 'GOODS', 'Stationery & Packaging', 'Corrugated Cartons, Packing Boxes & Paper Bags', 1200, datetime('now')),
('hsn_9608', '9608', 'GOODS', 'Stationery & Packaging', 'Ballpoint Pens, Gel Pens, Markers & Refills', 1200, datetime('now')),
('hsn_4802', '4802', 'GOODS', 'Stationery & Packaging', 'A4 Xerox Paper, Printing Paper & Envelopes', 1200, datetime('now')),
('hsn_3923', '3923', 'GOODS', 'Stationery & Packaging', 'Plastic Bubble Wrap, Shrink Film & Poly Bags', 1800, datetime('now'));

-- 9. Services (SAC Codes)
INSERT OR IGNORE INTO hsn_directory (id, code, type, category, description, default_gst_rate, created_at) VALUES
('sac_9983', '9983', 'SERVICES', 'Services (SAC)', 'IT Software, Website Design, Programming & Tech Support', 1800, datetime('now')),
('sac_9982', '9982', 'SERVICES', 'Services (SAC)', 'Legal, Accounting, Auditing & Bookkeeping Services', 1800, datetime('now')),
('sac_9965', '9965', 'SERVICES', 'Services (SAC)', 'Goods Transport Agency (GTA) & Road Freight Services', 500, datetime('now')),
('sac_9954', '9954', 'SERVICES', 'Services (SAC)', 'Building Construction, Renovation & Interior Services', 1800, datetime('now')),
('sac_9987', '9987', 'SERVICES', 'Services (SAC)', 'Repair & Maintenance of Electronics, ACs & Machinery', 1800, datetime('now')),
('sac_9963', '9963', 'SERVICES', 'Services (SAC)', 'Restaurant, Hotel Accommodation & Food Catering', 500, datetime('now')),
('sac_9972', '9972', 'SERVICES', 'Services (SAC)', 'Real Estate Brokerage, Rental & Leasing Services', 1800, datetime('now')),
('sac_9984', '9984', 'SERVICES', 'Services (SAC)', 'Telecommunications, Internet & Broadband Services', 1800, datetime('now'));
