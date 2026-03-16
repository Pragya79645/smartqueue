/**
 * Test Script for AI JSON API Integration
 * Tests the complete flow: AI Engine -> Backend -> Frontend
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000';
const AI_ENGINE_URL = 'http://localhost:8001';

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

async function testAiEngineHealth() {
  log.info('Testing AI Engine health...');
  try {
    const response = await axios.get(`${AI_ENGINE_URL}/health`);
    if (response.data.status === 'healthy') {
      log.success('AI Engine is healthy');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error) {
    log.error(`AI Engine health check failed: ${error.message}`);
    return false;
  }
}

async function testPredictionEndpoint() {
  log.info('Testing prediction endpoint...');
  try {
    const testData = {
      data: Array.from({ length: 60 }, (_, i) => 5 + Math.floor(Math.random() * 10)),
      minutes_ahead: 15
    };
    
    const response = await axios.post(`${AI_ENGINE_URL}/predict`, testData);
    
    if (response.data.success) {
      log.success('Prediction endpoint working');
      console.log('Sample response:');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error) {
    log.error(`Prediction test failed: ${error.message}`);
    return false;
  }
}

async function testDetectionEndpoint() {
  log.info('Testing queue detection endpoint...');
  try {
    const testData = {
      counters: [
        { counterId: "1", queueSize: 12, averageWaitTime: 36 },
        { counterId: "2", queueSize: 8, averageWaitTime: 24 },
        { counterId: "3", queueSize: 5, averageWaitTime: 15 }
      ],
      timestamp: new Date().toISOString(),
      camera_id: "test_cam_01"
    };
    
    const response = await axios.post(`${AI_ENGINE_URL}/queue/detection`, testData);
    
    if (response.data.success) {
      log.success('Detection endpoint working');
      console.log('Sample response:');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error) {
    log.error(`Detection test failed: ${error.message}`);
    return false;
  }
}

async function testComprehensiveAnalysis() {
  log.info('Testing comprehensive AI analysis endpoint...');
  try {
    const testData = {
      historical_data: Array.from({ length: 60 }, (_, i) => ({
        queueSize: 5 + Math.floor(Math.random() * 10),
        timestamp: new Date(Date.now() - (60 - i) * 60000).toISOString()
      })),
      current_counters: [
        { counterId: "1", queueSize: 12, averageWaitTime: 36 },
        { counterId: "2", queueSize: 8, averageWaitTime: 24 }
      ],
      minutes_ahead: 15
    };
    
    const response = await axios.post(`${AI_ENGINE_URL}/ai/analyze`, testData);
    
    if (response.data.success) {
      log.success('Comprehensive analysis endpoint working');
      console.log('Sample response:');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error) {
    log.error(`Comprehensive analysis test failed: ${error.message}`);
    return false;
  }
}

async function testBackendAiRoutes() {
  log.info('Testing Backend AI routes...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/ai/health`);
    
    if (response.data) {
      log.success('Backend AI routes working');
      console.log('Sample response:');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error) {
    log.error(`Backend AI routes test failed: ${error.message}`);
    if (error.response) {
      console.log('Error response:', error.response.data);
    }
    return false;
  }
}

async function testBackendAiAnalysis() {
  log.info('Testing Backend AI analysis endpoint...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/ai/analyze?minutesAhead=15`);
    
    if (response.data.success) {
      log.success('Backend AI analysis working');
      console.log('Sample response:');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error) {
    log.error(`Backend AI analysis test failed: ${error.message}`);
    if (error.response) {
      console.log('Error response:', error.response.data);
    }
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  AI JSON API Integration Test Suite');
  console.log('='.repeat(60) + '\n');

  const tests = [
    { name: 'AI Engine Health', fn: testAiEngineHealth },
    { name: 'Prediction Endpoint', fn: testPredictionEndpoint },
    { name: 'Detection Endpoint', fn: testDetectionEndpoint },
    { name: 'Comprehensive Analysis', fn: testComprehensiveAnalysis },
    { name: 'Backend AI Routes', fn: testBackendAiRoutes },
    { name: 'Backend AI Analysis', fn: testBackendAiAnalysis }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log('\n' + '-'.repeat(60));
    console.log(`Test: ${test.name}`);
    console.log('-'.repeat(60));
    
    const result = await test.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Test Results');
  console.log('='.repeat(60));
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log('='.repeat(60) + '\n');

  if (failed === 0) {
    log.success('All tests passed! 🎉');
    log.info('AI JSON API integration is working correctly.');
  } else {
    log.error(`${failed} test(s) failed.`);
    log.warn('Please check if both AI Engine and Backend servers are running.');
  }
}

// Run the tests
runAllTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  process.exit(1);
});
