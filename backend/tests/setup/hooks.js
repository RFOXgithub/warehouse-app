import { beforeEach, afterAll } from "vitest";
import { resetDatabase } from "../helpers/db.js";
import { closePool } from "@/src/lib/db.js";

beforeEach(resetDatabase);

afterAll(closePool);
