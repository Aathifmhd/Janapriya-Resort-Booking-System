import bcrypt from 'bcryptjs';
import { pool, all, get, run, insert, setSetting, transaction, ensureSchema, todayLocal } from './db.js';

const RESET = process.argv.includes('--reset');

function d(offsetDays) {
  return todayLocal(offsetDays);
}

export async function seedIfEmpty() {
  if (RESET) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query((await import('./db.js')).SCHEMA);
  } else {
    await ensureSchema();
  }
  const has = (await get('SELECT COUNT(*) AS c FROM users')).c;
  if (has > 0) return false;

  await transaction(async () => {
    // ---------- settings ----------
    const settings = {
      resort_name: 'Janapriya Resort',
      tagline: 'Where the lake meets the sky',
      address: 'Janapriya Resort, Lakeside Road, Sri Lanka',
      phone: '+94 77 123 4567',
      email: 'reservations@janapriyaresort.lk',
      currency: 'LKR',
      currency_symbol: 'Rs.',
      tax_rate: 18,
      service_charge_rate: 10,
      check_in_time: '14:00',
      check_out_time: '11:00',
      epf_employee_rate: 8,
      epf_employer_rate: 12,
      etf_rate: 3,
      overtime_multiplier: 1.5,
      working_days_per_month: 26,
      working_hours_per_day: 8,
      website_hero_title: 'Escape to Serenity',
      website_hero_subtitle: 'Luxury lakeside rooms, a fine-dining restaurant and a sunset bar - all in one unforgettable place.',
    };
    for (const [k, v] of Object.entries(settings)) await setSetting(k, v);

    // ---------- departments & employees ----------
    const depts = ['Management', 'Front Office', 'Housekeeping', 'Restaurant', 'Bar', 'Kitchen', 'Maintenance', 'Accounts', 'Security'];
    const deptIds = {};
    for (const name of depts) deptIds[name] = await insert('departments', { name });

    await insert('shifts', { name: 'Morning', start_time: '06:00', end_time: '14:00' });
    await insert('shifts', { name: 'Evening', start_time: '14:00', end_time: '22:00' });
    await insert('shifts', { name: 'Night', start_time: '22:00', end_time: '06:00' });

    const employees = [
      ['EMP001', 'Nimal Perera', 'Management', 'General Manager', 185000, 25000, 1],
      ['EMP002', 'Kumari Jayasinghe', 'Front Office', 'Front Office Manager', 95000, 10000, 1],
      ['EMP003', 'Ruwan Silva', 'Front Office', 'Receptionist', 55000, 5000, 1],
      ['EMP004', 'Sanduni Fernando', 'Housekeeping', 'Housekeeping Supervisor', 60000, 5000, 1],
      ['EMP005', 'Lasith Bandara', 'Housekeeping', 'Room Attendant', 42000, 3000, 1],
      ['EMP006', 'Chaminda Rathnayake', 'Restaurant', 'Restaurant Manager', 90000, 10000, 2],
      ['EMP007', 'Dilshan Wickramasinghe', 'Restaurant', 'Waiter', 45000, 4000, 2],
      ['EMP008', 'Tharushi Gunawardena', 'Restaurant', 'Waiter', 45000, 4000, 2],
      ['EMP009', 'Roshan De Silva', 'Bar', 'Head Bartender', 70000, 8000, 2],
      ['EMP010', 'Kasun Abeysekara', 'Bar', 'Bartender', 50000, 5000, 2],
      ['EMP011', 'Chef Mahinda Kumara', 'Kitchen', 'Executive Chef', 120000, 15000, 1],
      ['EMP012', 'Priyantha Herath', 'Kitchen', 'Sous Chef', 75000, 8000, 2],
      ['EMP013', 'Anura Dissanayake', 'Maintenance', 'Maintenance Technician', 52000, 5000, 1],
      ['EMP014', 'Shalini Peiris', 'Accounts', 'Accountant', 85000, 8000, 1],
      ['EMP015', 'Sunil Weerasinghe', 'Security', 'Security Officer', 40000, 5000, 3],
    ];
    const empIds = {};
    for (let i = 0; i < employees.length; i++) {
      const [code, name, dept, desig, basic, allow, shift] = employees[i];
      empIds[code] = await insert('employees', {
        emp_code: code, name, email: `${code.toLowerCase()}@janapriyaresort.lk`,
        phone: `+94 7${(10000000 + i * 1234567).toString().slice(0, 8)}`,
        nic: `${1985 + i}${String(100000000 + i * 3457).slice(-6)}V`,
        department_id: deptIds[dept], designation: desig, hire_date: d(-(400 + i * 37)),
        salary_basic: basic, allowances: allow, status: 'active', shift_id: shift,
        address: 'Sri Lanka', emergency_contact: '+94 71 000 0000',
      });
    }

    // ---------- users ----------
    const pw = (p) => bcrypt.hashSync(p, 10);
    const users = [
      ['Administrator', 'admin@janapriya.lk', 'admin123', 'admin', null],
      ['Nimal Perera', 'manager@janapriya.lk', 'manager123', 'manager', 'EMP001'],
      ['Ruwan Silva', 'frontdesk@janapriya.lk', 'frontdesk123', 'frontdesk', 'EMP003'],
      ['Chaminda Rathnayake', 'restaurant@janapriya.lk', 'restaurant123', 'restaurant', 'EMP006'],
      ['Roshan De Silva', 'bar@janapriya.lk', 'bar123', 'bar', 'EMP009'],
      ['Sanduni Fernando', 'housekeeping@janapriya.lk', 'housekeeping123', 'housekeeping', 'EMP004'],
      ['Shalini Peiris', 'accounts@janapriya.lk', 'accounts123', 'accounts', 'EMP014'],
      ['Kumari Jayasinghe', 'hr@janapriya.lk', 'hr123', 'hr', 'EMP002'],
    ];
    for (const [name, email, p, role, emp] of users) {
      await insert('users', { name, email, password_hash: pw(p), role, employee_id: emp ? empIds[emp] : null });
    }

    // ---------- room types & rooms ----------
    const types = [
      ['Standard Room', 'Cosy garden-facing room with all the essentials for a restful stay.', 12500, 2, 1, 28, ['Air conditioning', 'Hot water', 'Free Wi-Fi', 'Garden view', 'Tea & coffee'], 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80'],
      ['Deluxe Lake View', 'Spacious room with private balcony overlooking the lake.', 19500, 2, 2, 36, ['Air conditioning', 'Private balcony', 'Lake view', 'Mini bar', 'Smart TV', 'Free Wi-Fi'], 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&q=80'],
      ['Family Suite', 'Two bedrooms, living area and kitchenette - perfect for families.', 32000, 4, 3, 64, ['Two bedrooms', 'Living area', 'Kitchenette', 'Air conditioning', 'Smart TV', 'Free Wi-Fi'], 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&q=80'],
      ['Honeymoon Villa', 'Private villa with plunge pool, outdoor shower and sunset deck.', 48000, 2, 0, 80, ['Private plunge pool', 'Sunset deck', 'Outdoor shower', 'King bed', 'Butler service', 'Free Wi-Fi'], 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80'],
    ];
    const typeIds = [];
    for (const [name, description, rate, a, c, size, amen, img] of types) {
      typeIds.push(await insert('room_types', { name, description, base_rate: rate, max_adults: a, max_children: c, size_sqm: size, amenities: amen, image_url: img }));
    }
    const roomIds = [];
    const roomPlan = [
      [1, typeIds[0], ['101', '102', '103', '104', '105', '106']],
      [2, typeIds[1], ['201', '202', '203', '204', '205', '206']],
      [3, typeIds[2], ['301', '302', '303']],
      [0, typeIds[3], ['V1', 'V2', 'V3']],
    ];
    for (const [floor, tid, nums] of roomPlan) for (const n of nums) roomIds.push(await insert('rooms', { number: n, room_type_id: tid, floor, status: 'available' }));

    // ---------- guests & bookings ----------
    const guests = [
      ['Amal Jayawardena', 'amal@example.com', '+94 77 234 5678', '901234567V', 'Sri Lankan'],
      ['Sarah Thompson', 'sarah.t@example.com', '+44 7700 900123', 'GB1234567', 'British'],
      ['Hans Müller', 'hans.m@example.com', '+49 151 2345678', 'DE9876543', 'German'],
      ['Priya Raman', 'priya.r@example.com', '+91 98765 43210', 'IN5551234', 'Indian'],
      ['Dinesh Kodikara', 'dinesh@example.com', '+94 71 345 6789', '881234567V', 'Sri Lankan'],
      ['Emily Chen', 'emily.c@example.com', '+61 412 345 678', 'AU7654321', 'Australian'],
    ];
    const guestIds = [];
    for (const [name, email, phone, nic, nat] of guests) guestIds.push(await insert('guests', { name, email, phone, nic_passport: nic, nationality: nat }));

    const TAX = 18;
    let bookingCount = 0;
    const mkBooking = async (gi, roomIdx, typeIdx, ci, co, status, source, adults = 2, children = 0, createdOffset = -10) => {
      const nights = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
      const rate = types[typeIdx][2];
      const subtotal = rate * nights;
      const tax = subtotal * TAX / 100;
      const total = subtotal + tax;
      const code = `JR${String(++bookingCount).padStart(5, '0')}`;
      const id = await insert('bookings', {
        code, guest_id: guestIds[gi], room_id: roomIds[roomIdx], room_type_id: typeIds[typeIdx], check_in: ci, check_out: co,
        adults, children, status, source, rate, nights, subtotal, tax, discount: 0, total,
        checked_in_at: ['checked_in', 'checked_out'].includes(status) ? `${ci} 14:30` : null,
        checked_out_at: status === 'checked_out' ? `${co} 10:45` : null,
        created_at: `${d(createdOffset)} 10:00:00`,
      });
      await insert('booking_charges', { booking_id: id, description: `Room charge x ${nights} night(s)`, amount: subtotal, type: 'room' });
      if (status === 'checked_in') await run('UPDATE rooms SET status=? WHERE id=?', ['occupied', roomIds[roomIdx]]);
      return { id, total, code };
    };

    for (let i = 0; i < 14; i++) {
      const gi = i % guests.length; const typeIdx = i % 4; const roomIdx = [0, 6, 12, 15][typeIdx] + (i % 3);
      const ci = d(-(40 - i * 2)); const co = d(-(40 - i * 2) + 2 + (i % 3));
      const b = await mkBooking(gi, roomIdx, typeIdx, ci, co, 'checked_out', ['website', 'walkin', 'phone', 'agent'][i % 4], 2, i % 2, -(45 - i * 2));
      await insert('payments', { booking_id: b.id, amount: b.total, method: ['cash', 'card', 'bank', 'online'][i % 4], received_by: 1, created_at: `${co} 10:50:00` });
      await insert('invoices', { number: `INV-R-${String(i + 1).padStart(5, '0')}`, type: 'room', ref_id: b.id, guest_name: guests[gi][0], subtotal: b.total / 1.18, tax: b.total - b.total / 1.18, total: b.total, paid: b.total, status: 'paid', date: co, created_at: `${co} 10:50:00` });
    }
    const inhouse1 = await mkBooking(1, 7, 1, d(-2), d(2), 'checked_in', 'website', 2, 0, -12);
    await insert('payments', { booking_id: inhouse1.id, amount: 20000, method: 'card', note: 'Advance', received_by: 1 });
    await mkBooking(3, 13, 2, d(-1), d(3), 'checked_in', 'phone', 2, 2, -8);
    const inhouse3 = await mkBooking(5, 16, 3, d(0), d(4), 'checked_in', 'website', 2, 0, -20);
    await insert('payments', { booking_id: inhouse3.id, amount: inhouse3.total, method: 'online', note: 'Full prepayment', received_by: 1 });
    await mkBooking(0, 1, 0, d(1), d(3), 'confirmed', 'walkin', 2, 1, -3);
    await mkBooking(2, 8, 1, d(2), d(6), 'confirmed', 'website', 2, 0, -5);
    await mkBooking(4, 14, 2, d(5), d(8), 'pending', 'website', 3, 2, -1);
    await mkBooking(1, 17, 3, d(10), d(14), 'confirmed', 'agent', 2, 0, -2);
    await run("UPDATE rooms SET status='dirty' WHERE id=?", [roomIds[2]]);
    await run("UPDATE rooms SET status='maintenance', notes='AC unit repair' WHERE id=?", [roomIds[11]]);
    await insert('housekeeping_tasks', { room_id: roomIds[2], type: 'cleaning', priority: 'high', status: 'pending', assigned_to: empIds.EMP005, notes: 'Guest checked out this morning' });
    await insert('housekeeping_tasks', { room_id: roomIds[11], type: 'maintenance', priority: 'high', status: 'in_progress', assigned_to: empIds.EMP013, notes: 'AC not cooling - compressor check' });
    await insert('housekeeping_tasks', { room_id: roomIds[7], type: 'cleaning', priority: 'normal', status: 'pending', assigned_to: empIds.EMP005, notes: 'Daily service - in-house guest' });

    // ---------- suppliers ----------
    const sup = {
      lion: await insert('suppliers', { name: 'Lion Brewery (Ceylon) PLC', contact_person: 'Sales Desk', phone: '+94 11 246 5000', category: 'beer', address: 'Biyagama' }),
      dcsl: await insert('suppliers', { name: 'Distilleries Company of Sri Lanka', contact_person: 'Area Rep', phone: '+94 11 230 0000', category: 'liquor', address: 'Colombo' }),
      rockland: await insert('suppliers', { name: 'Rockland Distilleries', contact_person: 'Sales', phone: '+94 11 272 0000', category: 'liquor' }),
      coke: await insert('suppliers', { name: 'Coca-Cola Beverages Sri Lanka', contact_person: 'Distributor', phone: '+94 11 282 0000', category: 'soft_drink' }),
      fresh: await insert('suppliers', { name: 'Lakeside Fresh Produce', contact_person: 'Sunil', phone: '+94 77 999 1234', category: 'food' }),
      general: await insert('suppliers', { name: 'Hotel Supplies Lanka', contact_person: 'Ravi', phone: '+94 11 555 1234', category: 'general' }),
    };

    // ---------- inventory ----------
    const inv = [
      ['Lion Lager 625ml', 'beer', 'bottle', 625, 96, 48, 420, 750, 'lion', 1, 100, 34],
      ['Lion Lager 330ml', 'beer', 'bottle', 330, 120, 48, 260, 500, 'lion', 1, 60, 51],
      ['Lion Strong 625ml', 'beer', 'bottle', 625, 60, 36, 450, 800, 'lion', 1, 100, 22],
      ['Carlsberg 500ml Can', 'beer', 'can', 500, 72, 24, 390, 700, 'lion', 0, 0, 0],
      ['Old Arrack 750ml', 'liquor', 'bottle', 750, 24, 12, 3200, 0, 'dcsl', 1, 150, 9],
      ['Extra Special Arrack 750ml', 'liquor', 'bottle', 750, 18, 10, 2600, 0, 'dcsl', 1, 150, 6],
      ['Rockland Gin 750ml', 'liquor', 'bottle', 750, 10, 6, 3800, 0, 'rockland', 0, 0, 0],
      ['Smirnoff Vodka 750ml', 'liquor', 'bottle', 750, 8, 4, 6500, 0, 'rockland', 0, 0, 0],
      ['Johnnie Walker Black 750ml', 'liquor', 'bottle', 750, 6, 3, 14500, 0, 'rockland', 0, 0, 0],
      ['Bacardi White Rum 750ml', 'liquor', 'bottle', 750, 7, 4, 5900, 0, 'rockland', 0, 0, 0],
      ['House Red Wine 750ml', 'wine', 'bottle', 750, 14, 6, 3400, 6500, 'rockland', 0, 0, 0],
      ['House White Wine 750ml', 'wine', 'bottle', 750, 12, 6, 3400, 6500, 'rockland', 0, 0, 0],
      ['Coca-Cola 300ml', 'soft_drink', 'bottle', 300, 150, 60, 110, 300, 'coke', 1, 40, 62],
      ['Sprite 300ml', 'soft_drink', 'bottle', 300, 110, 48, 110, 300, 'coke', 1, 40, 41],
      ['Soda 300ml', 'soft_drink', 'bottle', 300, 140, 48, 90, 250, 'coke', 1, 40, 70],
      ['Mineral Water 500ml', 'soft_drink', 'bottle', 500, 200, 72, 60, 200, 'coke', 0, 0, 0],
      ['Tonic Water 200ml', 'soft_drink', 'bottle', 200, 40, 24, 180, 450, 'coke', 0, 0, 0],
      ['Chicken (whole)', 'food', 'kg', 0, 22, 10, 1250, 0, 'fresh', 0, 0, 0],
      ['Prawns (large)', 'food', 'kg', 0, 6, 5, 3200, 0, 'fresh', 0, 0, 0],
      ['Seer Fish', 'food', 'kg', 0, 9, 5, 2800, 0, 'fresh', 0, 0, 0],
      ['Basmati Rice', 'food', 'kg', 0, 45, 20, 520, 0, 'fresh', 0, 0, 0],
      ['Cooking Oil', 'food', 'litre', 0, 18, 10, 890, 0, 'fresh', 0, 0, 0],
      ['Mixed Vegetables', 'food', 'kg', 0, 30, 15, 380, 0, 'fresh', 0, 0, 0],
      ['Lime', 'food', 'kg', 0, 4, 3, 450, 0, 'fresh', 0, 0, 0],
      ['Bath Towel', 'housekeeping', 'pcs', 0, 80, 30, 1450, 0, 'general', 0, 0, 0],
      ['Toilet Roll', 'housekeeping', 'pcs', 0, 240, 100, 85, 0, 'general', 0, 0, 0],
      ['Shampoo 30ml', 'housekeeping', 'pcs', 0, 300, 100, 45, 0, 'general', 0, 0, 0],
      ['Soap Bar', 'housekeeping', 'pcs', 0, 350, 100, 35, 0, 'general', 0, 0, 0],
    ];
    const invIds = {};
    for (let i = 0; i < inv.length; i++) {
      const [name, category, unit, unit_size, qty, reorder, cost, sell, s, ret, dep, empties] = inv[i];
      invIds[name] = await insert('inventory_items', {
        sku: `SKU${String(i + 1).padStart(4, '0')}`, name, category, unit, unit_size, qty_on_hand: qty, reorder_level: reorder,
        cost_price: cost, sell_price: sell, supplier_id: sup[s], returnable_bottle: ret, bottle_deposit: dep, empties_on_hand: empties,
        location: category === 'housekeeping' ? 'housekeeping_store' : ['beer', 'liquor', 'wine', 'soft_drink'].includes(category) ? 'bar' : 'kitchen',
      });
      await insert('stock_movements', { inventory_item_id: invIds[name], qty, type: 'opening', note: 'Opening stock', user_id: 1, created_at: `${d(-30)} 09:00:00` });
    }

    const purchaseDefs = [
      ['lion', -25, [['Lion Lager 625ml', 96, 420], ['Lion Lager 330ml', 120, 260], ['Lion Strong 625ml', 60, 450]]],
      ['dcsl', -20, [['Old Arrack 750ml', 24, 3200], ['Extra Special Arrack 750ml', 18, 2600]]],
      ['coke', -15, [['Coca-Cola 300ml', 150, 110], ['Sprite 300ml', 110, 110], ['Soda 300ml', 140, 90], ['Mineral Water 500ml', 200, 60]]],
      ['fresh', -3, [['Chicken (whole)', 20, 1250], ['Prawns (large)', 5, 3200], ['Mixed Vegetables', 25, 380]]],
      ['rockland', -12, [['Johnnie Walker Black 750ml', 6, 14500], ['Smirnoff Vodka 750ml', 8, 6500], ['House Red Wine 750ml', 12, 3400]]],
    ];
    for (let i = 0; i < purchaseDefs.length; i++) {
      const [s, off, items] = purchaseDefs[i];
      const total = items.reduce((a, [, q, c]) => a + q * c, 0);
      const pid = await insert('purchases', { code: `PO${String(i + 1).padStart(5, '0')}`, supplier_id: sup[s], invoice_no: `SUP-${1000 + i}`, date: d(off), total, paid: i < 3 ? total : 0, status: i < 3 ? 'paid' : 'received', created_by: 1, created_at: `${d(off)} 11:00:00` });
      for (const [n, q, c] of items) await insert('purchase_items', { purchase_id: pid, inventory_item_id: invIds[n], qty: q, unit_cost: c });
    }

    await insert('empty_bottle_log', { inventory_item_id: invIds['Lion Lager 625ml'], qty: 48, action: 'returned', supplier_id: sup.lion, amount: 4800, note: 'Returned with weekly delivery', user_id: 1, created_at: `${d(-7)} 10:00:00` });
    await insert('empty_bottle_log', { inventory_item_id: invIds['Lion Lager 625ml'], qty: 2, action: 'broken', amount: 200, note: 'Dropped in bar store', user_id: 1, created_at: `${d(-5)} 22:10:00` });
    await insert('empty_bottle_log', { inventory_item_id: invIds['Coca-Cola 300ml'], qty: 72, action: 'returned', supplier_id: sup.coke, amount: 2880, note: 'Crates exchanged', user_id: 1, created_at: `${d(-4)} 09:30:00` });

    // ---------- tables ----------
    const tableDefs = [
      ['T1', 'restaurant', 2, 60, 60, 'round'], ['T2', 'restaurant', 2, 200, 60, 'round'], ['T3', 'restaurant', 4, 340, 60, 'square'],
      ['T4', 'restaurant', 4, 480, 60, 'square'], ['T5', 'restaurant', 6, 60, 200, 'rect'], ['T6', 'restaurant', 6, 260, 200, 'rect'],
      ['T7', 'restaurant', 8, 460, 200, 'rect'], ['T8', 'restaurant', 4, 60, 340, 'square'], ['T9', 'restaurant', 4, 200, 340, 'square'],
      ['T10', 'restaurant', 2, 340, 340, 'round'],
      ['B1', 'bar', 2, 60, 60, 'round'], ['B2', 'bar', 2, 180, 60, 'round'], ['B3', 'bar', 4, 300, 60, 'square'], ['B4', 'bar', 4, 440, 60, 'square'],
      ['B5', 'bar', 6, 60, 200, 'rect'], ['B6', 'bar', 4, 300, 200, 'square'], ['Counter', 'bar', 8, 60, 340, 'rect'],
      ['O1', 'outdoor', 4, 60, 60, 'square'], ['O2', 'outdoor', 4, 200, 60, 'square'], ['O3', 'outdoor', 6, 340, 60, 'rect'], ['O4', 'outdoor', 2, 60, 200, 'round'],
    ];
    const tableIds = {};
    for (const [name, area, cap, x, y, shape] of tableDefs) tableIds[name] = await insert('tables', { name, area, capacity: cap, x, y, shape });
    await insert('table_reservations', { table_id: tableIds.T7, guest_name: 'Perera Family', phone: '+94 77 111 2222', date: d(0), time: '19:30', party_size: 8, status: 'booked', notes: 'Birthday - need cake' });
    await insert('table_reservations', { table_id: tableIds.O3, guest_name: 'Sarah Thompson', phone: '+44 7700 900123', date: d(1), time: '20:00', party_size: 4, status: 'booked' });

    // ---------- menu ----------
    const cats = {};
    for (const [n, t, s] of [['Starters', 'food', 1], ['Sri Lankan Mains', 'food', 2], ['Western Mains', 'food', 3], ['Seafood', 'food', 4], ['Desserts', 'food', 5],
      ['Beer', 'beverage', 6], ['Spirits', 'liquor', 7], ['Cocktails', 'liquor', 8], ['Wine', 'beverage', 9], ['Soft Drinks', 'beverage', 10], ['Hot Beverages', 'beverage', 11]]) {
      cats[n] = await insert('menu_categories', { name: n, type: t, sort: s });
    }
    const menu = [
      ['Starters', 'Devilled Cuttlefish', 'Crispy cuttlefish tossed in spicy devilled sauce', 1650, 600, null, 1, 'spicy'],
      ['Starters', 'Chicken Spring Rolls', 'Golden fried, served with sweet chilli', 950, 320, null, 1, ''],
      ['Starters', 'Vegetable Samosa (3)', 'Crisp pastry with spiced potato and peas', 650, 200, null, 1, 'veg'],
      ['Sri Lankan Mains', 'Rice & Curry (Chicken)', 'Traditional plate with five curries & pol sambol', 1450, 550, null, 1, 'popular'],
      ['Sri Lankan Mains', 'Rice & Curry (Vegetarian)', 'Six seasonal vegetable curries with red rice', 1100, 380, null, 1, 'veg'],
      ['Sri Lankan Mains', 'Chicken Kottu', 'Chopped roti with chicken, egg & vegetables', 1350, 480, null, 1, 'popular'],
      ['Sri Lankan Mains', 'Lamprais', 'Dutch Burgher rice baked in banana leaf', 1850, 700, null, 1, ''],
      ['Western Mains', 'Grilled Chicken Steak', 'With mashed potato, veg & pepper sauce', 2250, 850, 'Chicken (whole)', 0.4, ''],
      ['Western Mains', 'Spaghetti Carbonara', 'Classic creamy pasta with bacon', 1950, 650, null, 1, ''],
      ['Western Mains', 'Club Sandwich & Fries', 'Triple-decker with chicken, egg & bacon', 1650, 550, null, 1, ''],
      ['Seafood', 'Grilled Seer Fish', 'Lime butter sauce, garden salad', 2850, 1100, 'Seer Fish', 0.35, 'chef'],
      ['Seafood', 'Garlic Butter Prawns', 'Large prawns, garlic, herbs', 3450, 1500, 'Prawns (large)', 0.3, 'chef'],
      ['Desserts', 'Watalappam', 'Jaggery & coconut custard', 650, 180, null, 1, 'popular'],
      ['Desserts', 'Curd & Treacle', 'Buffalo curd with kithul treacle', 550, 150, null, 1, ''],
      ['Desserts', 'Chocolate Brownie', 'Warm, with vanilla ice cream', 850, 260, null, 1, ''],
      ['Beer', 'Lion Lager 625ml', "Sri Lanka's favourite lager", 750, 420, 'Lion Lager 625ml', 1, 'popular'],
      ['Beer', 'Lion Lager 330ml', '', 500, 260, 'Lion Lager 330ml', 1, ''],
      ['Beer', 'Lion Strong 625ml', '8.8% ABV', 800, 450, 'Lion Strong 625ml', 1, ''],
      ['Beer', 'Carlsberg Can 500ml', '', 700, 390, 'Carlsberg 500ml Can', 1, ''],
      ['Spirits', 'Old Arrack (shot 60ml)', 'DCSL Old Arrack', 450, 256, 'Old Arrack 750ml', 0.08, ''],
      ['Spirits', 'Extra Special Arrack (shot 60ml)', '', 400, 208, 'Extra Special Arrack 750ml', 0.08, ''],
      ['Spirits', 'Gin (shot 60ml)', 'Rockland Dry Gin', 550, 304, 'Rockland Gin 750ml', 0.08, ''],
      ['Spirits', 'Vodka (shot 60ml)', 'Smirnoff', 750, 520, 'Smirnoff Vodka 750ml', 0.08, ''],
      ['Spirits', 'Johnnie Walker Black (shot 60ml)', '', 1800, 1160, 'Johnnie Walker Black 750ml', 0.08, 'premium'],
      ['Spirits', 'White Rum (shot 60ml)', 'Bacardi', 700, 472, 'Bacardi White Rum 750ml', 0.08, ''],
      ['Cocktails', 'Arrack Sour', 'Old Arrack, lime, sugar, egg white', 1200, 420, 'Old Arrack 750ml', 0.08, 'signature'],
      ['Cocktails', 'Mojito', 'White rum, mint, lime, soda', 1350, 520, 'Bacardi White Rum 750ml', 0.08, 'popular'],
      ['Cocktails', 'Gin & Tonic', 'Rockland gin with tonic', 1100, 480, 'Rockland Gin 750ml', 0.08, ''],
      ['Cocktails', 'Sunset Punch', 'Rum, passion fruit, orange, grenadine', 1250, 450, 'Bacardi White Rum 750ml', 0.06, 'signature'],
      ['Wine', 'House Red (glass)', '', 1500, 850, 'House Red Wine 750ml', 0.2, ''],
      ['Wine', 'House Red (bottle)', '', 6500, 3400, 'House Red Wine 750ml', 1, ''],
      ['Wine', 'House White (glass)', '', 1500, 850, 'House White Wine 750ml', 0.2, ''],
      ['Wine', 'House White (bottle)', '', 6500, 3400, 'House White Wine 750ml', 1, ''],
      ['Soft Drinks', 'Coca-Cola 300ml', '', 300, 110, 'Coca-Cola 300ml', 1, ''],
      ['Soft Drinks', 'Sprite 300ml', '', 300, 110, 'Sprite 300ml', 1, ''],
      ['Soft Drinks', 'Soda 300ml', '', 250, 90, 'Soda 300ml', 1, ''],
      ['Soft Drinks', 'Mineral Water 500ml', '', 200, 60, 'Mineral Water 500ml', 1, ''],
      ['Soft Drinks', 'Fresh Lime Juice', '', 450, 120, 'Lime', 0.05, 'popular'],
      ['Soft Drinks', 'King Coconut', '', 350, 120, null, 1, ''],
      ['Hot Beverages', 'Ceylon Tea', '', 300, 60, null, 1, ''],
      ['Hot Beverages', 'Cappuccino', '', 650, 180, null, 1, ''],
    ];
    const menuIds = {};
    for (const [cat, name, desc, price, cost, invName, portion, tags] of menu) {
      menuIds[name] = await insert('menu_items', { category_id: cats[cat], name, description: desc, price, cost, inventory_item_id: invName ? invIds[invName] : null, portion_qty: portion, tags });
    }

    // ---------- orders history ----------
    const SC = 10;
    let orderCount = 0; let fnbInvoiceCount = 0;
    const mkOrder = async (tableName, items, status, offsetDays, hour, bookingId = null) => {
      const code = `ORD${String(++orderCount).padStart(5, '0')}`;
      const subtotal = items.reduce((a, [n, q]) => a + menu.find((m) => m[1] === n)[3] * q, 0);
      const service_charge = subtotal * SC / 100; const tax = (subtotal + service_charge) * TAX / 100; const total = subtotal + service_charge + tax;
      const ts = `${d(offsetDays)} ${String(hour).padStart(2, '0')}:${String(10 + (subtotal % 50)).padStart(2, '0')}:00`;
      const id = await insert('orders', { code, table_id: tableIds[tableName], booking_id: bookingId, type: bookingId ? 'room_service' : 'dine_in', status, covers: 2 + (subtotal % 3), subtotal, tax, service_charge, discount: 0, total, waiter_id: empIds.EMP007, created_at: ts, closed_at: status === 'paid' ? ts : null });
      for (const [n, q] of items) await insert('order_items', { order_id: id, menu_item_id: menuIds[n], name: n, qty: q, price: menu.find((m) => m[1] === n)[3], status: status === 'open' ? 'preparing' : 'served', created_at: ts });
      if (status === 'paid') {
        await insert('payments', { order_id: id, amount: total, method: ['cash', 'card'][subtotal % 2], received_by: 1, created_at: ts });
        await insert('invoices', { number: `INV-F-${String(++fnbInvoiceCount).padStart(5, '0')}`, type: tableName.startsWith('B') ? 'bar' : 'restaurant', ref_id: id, guest_name: 'Walk-in', subtotal, tax, service_charge, total, paid: total, status: 'paid', date: d(offsetDays), created_at: ts });
      }
      if (status === 'open') await run("UPDATE tables SET status='occupied' WHERE id=?", [tableIds[tableName]]);
      return { id, total };
    };
    const pool_ = [
      ['T3', [['Rice & Curry (Chicken)', 2], ['Lion Lager 625ml', 2], ['Watalappam', 2]]],
      ['B1', [['Old Arrack (shot 60ml)', 4], ['Soda 300ml', 2], ['Devilled Cuttlefish', 1]]],
      ['T6', [['Grilled Seer Fish', 2], ['House White (glass)', 2], ['Chocolate Brownie', 1]]],
      ['B3', [['Mojito', 3], ['Arrack Sour', 2], ['Chicken Spring Rolls', 2]]],
      ['O2', [['Chicken Kottu', 2], ['Coca-Cola 300ml', 2]]],
      ['T1', [['Spaghetti Carbonara', 1], ['Cappuccino', 2]]],
      ['Counter', [['Lion Lager 625ml', 6], ['Johnnie Walker Black (shot 60ml)', 2]]],
      ['T9', [['Garlic Butter Prawns', 1], ['Lamprais', 1], ['Fresh Lime Juice', 2]]],
    ];
    for (let day = 30; day >= 1; day--) {
      const n = 2 + (day % 3);
      for (let k = 0; k < n; k++) {
        const [t, items] = pool_[(day + k) % pool_.length];
        await mkOrder(t, items, 'paid', -day, 12 + ((day + k * 3) % 10));
      }
    }
    await mkOrder('T3', [['Rice & Curry (Chicken)', 2], ['Lion Lager 625ml', 2]], 'open', 0, 12);
    await mkOrder('B3', [['Mojito', 2], ['Devilled Cuttlefish', 1]], 'open', 0, 13);
    await mkOrder('T6', [['Grilled Seer Fish', 1], ['Garlic Butter Prawns', 1], ['House White (bottle)', 1]], 'open', 0, 13);
    // room service charged to in-house guest (billed to folio, not paid directly)
    const rs = await mkOrder('T1', [['Club Sandwich & Fries', 2], ['Fresh Lime Juice', 2]], 'billed', -1, 20, inhouse1.id);
    await run("UPDATE orders SET type='room_service', table_id=NULL WHERE id=?", [rs.id]);
    await insert('booking_charges', { booking_id: inhouse1.id, description: 'Room service - Club Sandwich x2, Lime Juice x2', amount: rs.total, type: 'restaurant', ref_id: rs.id });

    // ---------- expenses ----------
    const exp = [
      ['utilities', 'Electricity bill - CEB', 186500, -6, 'Ceylon Electricity Board', 'bank'],
      ['utilities', 'Water bill - NWSDB', 24300, -6, 'Water Board', 'bank'],
      ['maintenance', 'Pool pump service', 18500, -9, 'AquaTech Services', 'cash'],
      ['marketing', 'Facebook & Google ads', 35000, -12, 'Meta / Google', 'card'],
      ['supplies', 'Gas cylinders x6', 27600, -4, 'Litro Gas', 'cash'],
      ['transport', 'Guest airport transfer fuel', 12800, -2, 'Fuel station', 'cash'],
      ['maintenance', 'Generator fuel', 42000, -14, 'Fuel station', 'cash'],
      ['licenses', 'Liquor licence renewal (annual)', 150000, -22, 'Excise Department', 'bank'],
      ['utilities', 'Internet - SLT Fibre', 12500, -18, 'SLT', 'bank'],
      ['general', 'Garden maintenance', 15000, -8, 'Green Hands', 'cash'],
    ];
    for (const [category, description, amount, off, paid_to, method] of exp) await insert('expenses', { category, description, amount, date: d(off), paid_to, method, created_by: 1 });

    // ---------- attendance (last 30 days) ----------
    const empRows = await all('SELECT id FROM employees');
    for (let off = 30; off >= 0; off--) {
      const date = d(-off);
      const dow = new Date(date).getDay();
      for (const e of empRows) {
        const rnd = (e.id * 31 + off * 17) % 20;
        if (dow === 0 && rnd < 10) continue;
        let status = 'present';
        if (rnd === 0) status = 'absent'; else if (rnd === 1) status = 'leave'; else if (rnd === 2) status = 'half_day';
        const hours = status === 'present' ? 8 + (rnd > 15 ? 2 : 0) : status === 'half_day' ? 4 : 0;
        if (off === 0 && rnd > 12) continue;
        await insert('attendance', { employee_id: e.id, date, check_in: hours ? '08:0' + (rnd % 10) : null, check_out: hours ? (hours >= 8 ? `${8 + hours}:0${rnd % 10}` : '12:00') : null, status, hours, overtime_hours: hours > 8 ? hours - 8 : 0 });
      }
    }
    await insert('leaves', { employee_id: empIds.EMP007, type: 'annual', from_date: d(3), to_date: d(5), days: 3, reason: 'Family trip', status: 'pending' });
    await insert('leaves', { employee_id: empIds.EMP010, type: 'sick', from_date: d(-2), to_date: d(-1), days: 2, reason: 'Fever', status: 'approved' });
    await insert('leaves', { employee_id: empIds.EMP005, type: 'casual', from_date: d(7), to_date: d(7), days: 1, reason: 'Personal', status: 'pending' });

    // ---------- payroll (last month, paid) ----------
    const [ty, tm] = d(0).split('-').map(Number);
    const lm = tm === 1 ? `${ty - 1}-12` : `${ty}-${String(tm - 1).padStart(2, '0')}`;
    for (const e of await all('SELECT * FROM employees')) {
      const epfE = e.salary_basic * 0.08, epfR = e.salary_basic * 0.12, etf = e.salary_basic * 0.03;
      const gross = e.salary_basic + e.allowances;
      await insert('payroll', { employee_id: e.id, month: lm, basic: e.salary_basic, allowances: e.allowances, overtime: 0, bonus: 0, deductions: 0, epf_employee: epfE, epf_employer: epfR, etf, net: gross - epfE, status: 'paid', paid_at: `${lm}-28 16:00:00` });
    }
  });
  return true;
}

// Run directly: `node --env-file=.env src/seed.js --reset`
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/src/seed.js')) {
  const t0 = Date.now();
  const done = await seedIfEmpty();
  console.log(done ? `Database seeded with demo data in ${Math.round((Date.now() - t0) / 1000)}s.` : 'Database already has data (use --reset to rebuild).');
  await pool.end();
}
