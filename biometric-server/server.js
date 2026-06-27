/**
 * eSSL F22 Biometric Attendance Integration Server
 * ADMS / Push Data Protocol Implementation
 * 
 * ============================================
 * SUPABASE SQL SCHEMA - Run this in Supabase SQL Editor
 * ============================================
 * 
 * -- Attendance Logs Table
 * CREATE TABLE IF NOT EXISTS attendance_logs (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id VARCHAR(50) NOT NULL,
 *   device_id VARCHAR(50) NOT NULL,
 *   timestamp TIMESTAMPTZ NOT NULL,
 *   status VARCHAR(20) DEFAULT 'CHECK_IN',
 *   raw_data JSONB,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Create index for faster queries
 * CREATE INDEX idx_attendance_logs_user_id ON attendance_logs(user_id);
 * CREATE INDEX idx_attendance_logs_device_id ON attendance_logs(device_id);
 * CREATE INDEX idx_attendance_logs_timestamp ON attendance_logs(timestamp);
 * 
 * -- Device Commands Table
 * CREATE TABLE IF NOT EXISTS device_commands (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   device_sn VARCHAR(50) NOT NULL,
 *   command_string TEXT NOT NULL,
 *   status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'SUCCESS', 'FAILED')),
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Create index for device commands
 * CREATE INDEX idx_device_commands_device_sn ON device_commands(device_sn);
 * CREATE INDEX idx_device_commands_status ON device_commands(status);
 * 
 * ============================================
 */

import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import admsRoutes from './routes/adms.js';

// Initialize Fastify with logging
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true
      }
    }
  },
  // Increase body size limit for attendance data
  bodyLimit: 1048576, // 1MB
});

// Register form body parser (ADMS sends form-urlencoded data)
await fastify.register(formbody);

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register ADMS routes
fastify.register(admsRoutes, { prefix: '/iclock' });

// Global error handler - never crash on bad input
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  // Always return OK to device to prevent retries
  if (request.url.includes('/iclock')) {
    reply.code(200).send('OK');
  } else {
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  fastify.log.warn(`404 - Route not found: ${request.method} ${request.url}`);
  reply.code(200).send('OK');
});

// Start server
const start = async () => {
  try {
    const PORT = process.env.PORT || 8080;
    const HOST = '0.0.0.0'; // Listen on all interfaces for external access
    
    await fastify.listen({ port: PORT, host: HOST });
    
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     eSSL F22 Biometric Attendance Server                     ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on: http://${HOST}:${PORT}                       ║
║  Health Check:      http://${HOST}:${PORT}/health                ║
║                                                              ║
║  ADMS Endpoints:                                             ║
║  • POST /iclock/cdata      - Receive attendance punches      ║
║  • GET  /iclock/getrequest - Device polls for commands       ║
║  • POST /iclock/devicecmd  - Device command confirmation     ║
║  • GET  /iclock/ping       - Device heartbeat                ║
╚══════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

start();
