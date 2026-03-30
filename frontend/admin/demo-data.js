// demo-data.js — CityFix Admin Portal demo data

/* ── Departments ── */
const DEPARTMENTS = [
  'Roads & Infrastructure',
  'Water Supply',
  'Electricity',
  'Sanitation',
  'Parks & Recreation',
  'Public Safety',
];

/* ── Officers ── */
const DEMO_OFFICERS = [
  { id:'OFF-001', name:'Rajesh Kumar',   designation:'Senior Inspector',   department:'Roads & Infrastructure', status:'Active',   email:'rajesh@cityfix.gov.in',   phone:'9876543210', casesHandled:42, casesResolved:38, joinDate:'Jan 12, 2022' },
  { id:'OFF-002', name:'Priya Sharma',   designation:'Field Officer',      department:'Water Supply',           status:'Active',   email:'priya@cityfix.gov.in',    phone:'9876543211', casesHandled:36, casesResolved:30, joinDate:'Mar 5, 2022'  },
  { id:'OFF-003', name:'Arun Nair',      designation:'Supervisor',         department:'Electricity',            status:'On Leave', email:'arun@cityfix.gov.in',     phone:'9876543212', casesHandled:28, casesResolved:22, joinDate:'Jun 18, 2021' },
  { id:'OFF-004', name:'Deepa Pillai',   designation:'Inspector',          department:'Sanitation',             status:'Active',   email:'deepa@cityfix.gov.in',    phone:'9876543213', casesHandled:51, casesResolved:47, joinDate:'Nov 2, 2021'  },
  { id:'OFF-005', name:'Suresh Babu',    designation:'Senior Field Officer',department:'Roads & Infrastructure', status:'Active',   email:'suresh@cityfix.gov.in',   phone:'9876543214', casesHandled:33, casesResolved:28, joinDate:'Feb 14, 2023' },
  { id:'OFF-006', name:'Meena Iyer',     designation:'Field Officer',      department:'Parks & Recreation',     status:'Active',   email:'meena@cityfix.gov.in',    phone:'9876543215', casesHandled:19, casesResolved:17, joinDate:'Jul 20, 2023' },
  { id:'OFF-007', name:'Venkat Reddy',   designation:'Inspector',          department:'Public Safety',          status:'Active',   email:'venkat@cityfix.gov.in',   phone:'9876543216', casesHandled:44, casesResolved:39, joinDate:'Sep 9, 2020'  },
  { id:'OFF-008', name:'Kavitha Menon',  designation:'Supervisor',         department:'Water Supply',           status:'On Leave', email:'kavitha@cityfix.gov.in',  phone:'9876543217', casesHandled:25, casesResolved:20, joinDate:'Apr 1, 2022'  },
];

/* ── Citizens ── */
const DEMO_CITIZENS = [
  { id:'CIT-001', name:'Aarav Sharma',    email:'aarav@email.com',    phone:'9000000001', totalComplaints:3, joinDate:'Jan 10, 2023' },
  { id:'CIT-002', name:'Bhavna Mehta',    email:'bhavna@email.com',   phone:'9000000002', totalComplaints:1, joinDate:'Feb 14, 2023' },
  { id:'CIT-003', name:'Chetan Rao',      email:'chetan@email.com',   phone:'9000000003', totalComplaints:4, joinDate:'Mar 5, 2023'  },
  { id:'CIT-004', name:'Divya Krishnan',  email:'divya@email.com',    phone:'9000000004', totalComplaints:2, joinDate:'Apr 20, 2023' },
  { id:'CIT-005', name:'Eshan Patel',     email:'eshan@email.com',    phone:'9000000005', totalComplaints:5, joinDate:'May 1, 2023'  },
  { id:'CIT-006', name:'Fatima Sheikh',   email:'fatima@email.com',   phone:'9000000006', totalComplaints:1, joinDate:'Jun 8, 2023'  },
  { id:'CIT-007', name:'Gaurav Singh',    email:'gaurav@email.com',   phone:'9000000007', totalComplaints:2, joinDate:'Jul 15, 2023' },
  { id:'CIT-008', name:'Hema Nair',       email:'hema@email.com',     phone:'9000000008', totalComplaints:3, joinDate:'Aug 22, 2023' },
];

/* ── Complaints ── */
const DEMO_COMPLAINTS = [
  { id:'COMP-001', title:'Large pothole on MG Road',             citizen:'Aarav Sharma',   citizenId:'CIT-001', department:'Roads & Infrastructure', status:'Pending',     priority:'Critical', date:'2026-03-10', description:'Deep pothole near bus stop causing vehicle damage. Approx 2ft wide and 6 inches deep.' },
  { id:'COMP-002', title:'Water supply disruption in Sector 4',  citizen:'Bhavna Mehta',   citizenId:'CIT-002', department:'Water Supply',           status:'In Progress', priority:'High',     date:'2026-03-09', description:'No water supply since 3 days. Affecting 50+ households in the area.' },
  { id:'COMP-003', title:'Street light failure on Gandhi Nagar', citizen:'Chetan Rao',     citizenId:'CIT-003', department:'Electricity',            status:'Resolved',    priority:'Medium',   date:'2026-03-08', description:'Entire street dark since last week. Safety concern for pedestrians.' },
  { id:'COMP-004', title:'Garbage not collected for 5 days',     citizen:'Divya Krishnan', citizenId:'CIT-004', department:'Sanitation',             status:'Pending',     priority:'High',     date:'2026-03-07', description:'Overflowing bins near the market area causing health hazard.' },
  { id:'COMP-005', title:'Broken benches in Central Park',       citizen:'Eshan Patel',    citizenId:'CIT-005', department:'Parks & Recreation',     status:'Resolved',    priority:'Low',      date:'2026-03-06', description:'Several benches have sharp broken edges posing injury risk to children.' },
  { id:'COMP-006', title:'Sewage overflow on Ring Road',         citizen:'Fatima Sheikh',  citizenId:'CIT-006', department:'Sanitation',             status:'In Progress', priority:'Critical', date:'2026-03-05', description:'Sewage overflowing onto main road. Strong odour and public health concern.' },
  { id:'COMP-007', title:'Illegal construction blocking road',   citizen:'Gaurav Singh',   citizenId:'CIT-007', department:'Public Safety',          status:'Pending',     priority:'High',     date:'2026-03-04', description:'Unauthorized construction has blocked half the road near school.' },
  { id:'COMP-008', title:'Water pipeline burst near market',     citizen:'Hema Nair',      citizenId:'CIT-008', department:'Water Supply',           status:'Resolved',    priority:'Critical', date:'2026-03-03', description:'Major pipeline burst causing road flooding and water wastage.' },
  { id:'COMP-009', title:'Footpath encroachment by vendors',     citizen:'Aarav Sharma',   citizenId:'CIT-001', department:'Public Safety',          status:'Pending',     priority:'Medium',   date:'2026-03-02', description:'Vendors have permanently blocked the footpath forcing pedestrians on road.' },
  { id:'COMP-010', title:'Streetlight timings incorrect',        citizen:'Chetan Rao',     citizenId:'CIT-003', department:'Electricity',            status:'Resolved',    priority:'Low',      date:'2026-02-28', description:'Streetlights turning on at noon and off at midnight — clearly misconfigured.' },
  { id:'COMP-011', title:'Drainage blocked causing flooding',    citizen:'Eshan Patel',    citizenId:'CIT-005', department:'Roads & Infrastructure', status:'In Progress', priority:'Critical', date:'2026-02-25', description:'Main drain blocked with construction debris. Even light rain causes flooding.' },
  { id:'COMP-012', title:'Mosquito breeding in stagnant water',  citizen:'Divya Krishnan', citizenId:'CIT-004', department:'Sanitation',             status:'Pending',     priority:'High',     date:'2026-02-20', description:'Stagnant water behind the school due to blocked drain. Dengue risk.' },
  { id:'COMP-013', title:'Park lights not working at night',     citizen:'Bhavna Mehta',   citizenId:'CIT-002', department:'Parks & Recreation',     status:'Rejected',    priority:'Low',      date:'2026-02-15', description:'All lights in the park are non-functional after 8 PM.' },
  { id:'COMP-014', title:'Road caving in near flyover',         citizen:'Gaurav Singh',   citizenId:'CIT-007', department:'Roads & Infrastructure', status:'Pending',     priority:'Critical', date:'2026-02-10', description:'Road surface caving in near the bridge pillar — structural concern.' },
  { id:'COMP-015', title:'Transformer burning smell',           citizen:'Hema Nair',      citizenId:'CIT-008', department:'Electricity',            status:'Resolved',    priority:'Critical', date:'2026-02-08', description:'Burning smell from transformer box on main road since yesterday.' },
  { id:'COMP-016', title:'Broken water meter, excess billing',  citizen:'Aarav Sharma',   citizenId:'CIT-001', department:'Water Supply',           status:'Pending',     priority:'Medium',   date:'2026-02-05', description:'Faulty meter showing 5x normal usage. Getting incorrect bills.' },
  { id:'COMP-017', title:'Tree fallen blocking road',           citizen:'Chetan Rao',     citizenId:'CIT-003', department:'Parks & Recreation',     status:'Resolved',    priority:'High',     date:'2026-01-30', description:'Large tree fell during storm blocking the road and damaging a car.' },
  { id:'COMP-018', title:'Suspicious activity near warehouse',  citizen:'Fatima Sheikh',  citizenId:'CIT-006', department:'Public Safety',          status:'In Progress', priority:'High',     date:'2026-01-25', description:'Unusual movement near abandoned warehouse. Residents feel unsafe.' },
];

/* ── Officer Registration Requests ── */
const DEMO_OFFICER_REQUESTS = [
  { id:'REQ-001', name:'Arjun Verma',    designation:'Field Officer',       department:'Roads & Infrastructure', email:'arjun.v@gov.in',   phone:'9111000001', experience:'3 years', qualification:'B.Tech Civil',    requestDate:'Mar 8, 2026',  status:'Pending'  },
  { id:'REQ-002', name:'Sneha Kulkarni', designation:'Inspector',           department:'Water Supply',           email:'sneha.k@gov.in',   phone:'9111000002', experience:'5 years', qualification:'B.Sc Environmental',requestDate:'Mar 7, 2026',  status:'Pending'  },
  { id:'REQ-003', name:'Rohit Joshi',    designation:'Senior Field Officer', department:'Electricity',           email:'rohit.j@gov.in',   phone:'9111000003', experience:'7 years', qualification:'B.Tech Electrical', requestDate:'Mar 5, 2026',  status:'Pending'  },
  { id:'REQ-004', name:'Anita Das',      designation:'Supervisor',          department:'Sanitation',             email:'anita.d@gov.in',   phone:'9111000004', experience:'4 years', qualification:'B.Sc Chemistry',    requestDate:'Mar 3, 2026',  status:'Pending'  },
  { id:'REQ-005', name:'Kiran Bose',     designation:'Inspector',           department:'Public Safety',          email:'kiran.b@gov.in',   phone:'9111000005', experience:'6 years', qualification:'B.A. Criminology',  requestDate:'Feb 28, 2026', status:'Accepted' },
  { id:'REQ-006', name:'Pooja Iyer',     designation:'Field Officer',       department:'Parks & Recreation',     email:'pooja.i@gov.in',   phone:'9111000006', experience:'2 years', qualification:'B.Sc Botany',        requestDate:'Feb 20, 2026', status:'Rejected' },
];

/* ── Time filter utility ── */
function filterByTime(data, dateField, filter) {
  if (filter === 'all') return data;
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return data.filter(item => {
    const d = new Date(item[dateField]);
    if (filter === 'today')        return d >= today;
    if (filter === 'this-week')    return d >= new Date(today.getTime() - 7  * 864e5);
    if (filter === 'this-month')   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (filter === 'this-year')    return d.getFullYear() === now.getFullYear();
    if (filter === 'last-6-months') return d >= new Date(today.getTime() - 180 * 864e5);
    if (filter === 'last-year')    return d >= new Date(today.getTime() - 365 * 864e5);
    return true;
  });
}
