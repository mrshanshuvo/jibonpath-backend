import { AmbulanceType, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../config/db";

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // 1. Admin User
  const admin = await prisma.user.upsert({
    where: { email: "admin@ambulance.dev" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@ambulance.dev",
      passwordHash: await hash("Admin@123"),
      role: Role.ADMIN,
      phone: "01700000001",
    },
  });

  // 2. Driver User
  const driverUser = await prisma.user.upsert({
    where: { email: "driver1@ambulance.dev" },
    update: {},
    create: {
      name: "Driver One",
      email: "driver1@ambulance.dev",
      passwordHash: await hash("Driver@123"),
      role: Role.DRIVER,
      phone: "01700000002",
    },
  });

  // 3. Patient User
  await prisma.user.upsert({
    where: { email: "patient1@ambulance.dev" },
    update: {},
    create: {
      name: "Patient One",
      email: "patient1@ambulance.dev",
      passwordHash: await hash("Patient@123"),
      role: Role.PATIENT,
      phone: "01700000003",
    },
  });

  // 4. Ambulances
  const ambulance1 = await prisma.ambulance.upsert({
    where: { vehicleNumber: "AMB-001" },
    update: {},
    create: {
      vehicleNumber: "AMB-001",
      type: AmbulanceType.ADVANCED_LIFE_SUPPORT,
      make: "Toyota HiAce",
      year: 2023,
    },
  });

  await prisma.ambulance.upsert({
    where: { vehicleNumber: "AMB-002" },
    update: {},
    create: {
      vehicleNumber: "AMB-002",
      type: AmbulanceType.BASIC,
      make: "Ford Transit",
      year: 2022,
    },
  });

  await prisma.ambulance.upsert({
    where: { vehicleNumber: "AMB-003" },
    update: {},
    create: {
      vehicleNumber: "AMB-003",
      type: AmbulanceType.INTENSIVE_CARE,
      make: "Mercedes Sprinter",
      year: 2024,
    },
  });

  // 5. Driver Profile
  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      licenseNumber: "DL-2024-001",
      ambulanceId: ambulance1.id,
    },
  });

  // 6. Hospitals
  await prisma.hospital.createMany({
    skipDuplicates: true,
    data: [
      {
        name: "Dhaka Medical College Hospital",
        address: "Secretariat Rd, Dhaka",
        phone: "02-55165000",
        capacity: 50,
        lat: 23.7258,
        lng: 90.3976,
      },
      {
        name: "Square Hospital",
        address: "18/F Bir Uttam Qazi Nuruzzaman Sarak, Dhaka",
        phone: "02-8159457",
        capacity: 30,
        lat: 23.7533,
        lng: 90.3819,
      },
      {
        name: "Evercare Hospital",
        address: "Plot 81, Block E, Bashundhara R/A, Dhaka",
        phone: "02-8431661",
        capacity: 40,
        lat: 23.8105,
        lng: 90.4312,
      },
    ],
  });

  console.log("✅ Seed data successfully created:");
  console.log("   Admin:   admin@ambulance.dev / Admin@123");
  console.log("   Driver:  driver1@ambulance.dev / Driver@123");
  console.log("   Patient: patient1@ambulance.dev / Patient@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
