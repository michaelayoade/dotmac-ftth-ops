/**
 * Platform Admin App - useLogs tests
 * Runs the shared test suite for log management functionality
 */
import { useLogs } from "../useLogs";
import { runUseLogsSuite } from "../../../../tests/hooks/runUseLogsSuite";
import axios from "axios";

jest.unmock("@tanstack/react-query");

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Run the shared test suite
runUseLogsSuite(useLogs, mockedAxios);
