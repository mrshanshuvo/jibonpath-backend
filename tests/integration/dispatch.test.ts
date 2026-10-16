import bcrypt from "bcrypt";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/config/db";

describe("Dispatch Module Integration Tests", () => {
  const timestamp = Date.now();
  let adminToken = "";
  let driverToken = "";
  let driverUserId = "";
  let driverId = "";
  let patientToken = "";
  let dispatchId = "";

  it("Setup: Create Admin, Driver, Patient and an active Dispatch", async () => {
    const passwordHash = await bcrypt.hash("Password123", 10);

    // 1. Create Admin
    const adminUser = await prisma.user.create({
      data: {
        name: `Dispatch Admin ${timestamp}`,
        email: `disp_admin_${timestamp}@example.com`,
        passwordHash,
        role: "ADMIN",
      },
    });
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: adminUser.email, password: "Password123" });
    adminToken = adminLogin.body.data.accessToken;

    // 2. Create Driver User + Driver profile
    const driverUser = await prisma.user.create({
      data: {
        name: `Dispatch Driver ${timestamp}`,
        email: `disp_driver_${timestamp}@example.com`,
        passwordHash,
        role: "DRIVER",
      },
    });
    driverUserId = driverUser.id;

    const driverRecord = await prisma.driver.create({
      data: {
        userId: driverUserId,
        licenseNumber: `DL-DISP-${timestamp}`,
        isAvailable: false,
      },
    });
    driverId = driverRecord.id;

    const driverLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: driverUser.email, password: "Password123" });
    driverToken = driverLogin.body.data.accessToken;

    // 3. Create Patient
    const patientUser = await prisma.user.create({
      data: {
        name: `Dispatch Patient ${timestamp}`,
        email: `disp_patient_${timestamp}@example.com`,
        passwordHash,
        role: "PATIENT",
      },
    });
    const patientLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: patientUser.email, password: "Password123" });
    patientToken = patientLogin.body.data.accessToken;

    // 4. Create Ambulance
    const ambulance = await prisma.ambulance.create({
      data: {
        vehicleNumber: `AMB-DISP-${timestamp}`,
        type: "ADVANCED_LIFE_SUPPORT",
        status: "DISPATCHED",
      },
    });

    // 5. Create Emergency Request
    const emergencyReq = await prisma.emergencyRequest.create({
      data: {
        callerId: patientUser.id,
        pickupAddress: "Gulshan 2, Circle, Dhaka",
        priority: "CRITICAL",
        status: "DISPATCHED",
      },
    });

    // 6. Create Dispatch
    const dispatch = await prisma.dispatch.create({
      data: {
        requestId: emergencyReq.id,
        ambulanceId: ambulance.id,
        driverId: driverId,
        status: "DISPATCHED",
      },
    });
    dispatchId = dispatch.id;

    expect(adminToken).toBeDefined();
    expect(driverToken).toBeDefined();
    expect(patientToken).toBeDefined();
    expect(dispatchId).toBeDefined();
  });

  describe("GET /api/v1/dispatches", () => {
    it("Admin can list all dispatches with pagination", async () => {
      const res = await request(app)
        .get("/api/v1/dispatches?page=1&limit=10")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.dispatches)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
    });

    it("Admin can filter dispatches by ?status=DISPATCHED", async () => {
      const res = await request(app)
        .get("/api/v1/dispatches?status=DISPATCHED")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.dispatches)).toBe(true);
      for (const d of res.body.data.dispatches) {
        expect(d.status).toBe("DISPATCHED");
      }
    });

    it("Driver only sees their own assigned dispatches", async () => {
      const res = await request(app)
        .get("/api/v1/dispatches")
        .set("Authorization", `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.dispatches)).toBe(true);
      for (const d of res.body.data.dispatches) {
        expect(d.driverId).toBe(driverId);
      }
    });

    it("Rejects invalid query status with 422", async () => {
      const res = await request(app)
        .get("/api/v1/dispatches?status=NOT_A_STATUS")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it("Rejects unauthorized role (PATIENT) with 403", async () => {
      const res = await request(app)
        .get("/api/v1/dispatches")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });

    it("Rejects unauthenticated requests with 401", async () => {
      const res = await request(app).get("/api/v1/dispatches");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/dispatches/my-active", () => {
    it("Driver can fetch their ongoing active dispatch", async () => {
      const res = await request(app)
        .get("/api/v1/dispatches/my-active")
        .set("Authorization", `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(dispatchId);
      expect(res.body.data.driverId).toBe(driverId);
      expect(res.body.data.ambulance).toBeDefined();
      expect(res.body.data.request).toBeDefined();
    });

    it("Rejects non-driver role with 403", async () => {
      const res = await request(app)
        .get("/api/v1/dispatches/my-active")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });

    it("Rejects unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/v1/dispatches/my-active");
      expect(res.status).toBe(401);
    });
  });

  describe("Live Telemetry & Tracking Integration", () => {
    it("Driver broadcasts real-time GPS coordinate tick", async () => {
      const res = await request(app)
        .post(`/api/v1/dispatches/${dispatchId}/location`)
        .set("Authorization", `Bearer ${driverToken}`)
        .send({
          lat: 23.8103,
          lng: 90.4125,
          heading: 45,
          speedKmh: 42,
          stage: "EN_ROUTE",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lat).toBe(23.8103);
      expect(res.body.data.lng).toBe(90.4125);
      expect(res.body.data.speedKmh).toBe(42);
      expect(res.body.data.heading).toBe(45);
    });

    it("Patient can fetch latest telemetry coordinate", async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/${dispatchId}/telemetry/latest`)
        .set("Authorization", `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.lat).toBe(23.8103);
      expect(res.body.data.lng).toBe(90.4125);
    });

    it("Patient can look up dispatch details with latest telemetry attached", async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/${dispatchId}`)
        .set("Authorization", `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(dispatchId);
      expect(res.body.data.latestTelemetry).toBeDefined();
      expect(res.body.data.latestTelemetry.lat).toBe(23.8103);
    });
  });
});
