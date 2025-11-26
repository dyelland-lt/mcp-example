#!/bin/bash

echo "🚀 Starting MCP server and ngrok tunnel..."
echo ""

# Check and generate SSL certificates if needed
if [ ! -f "certs/localhost-cert.pem" ] || [ ! -f "certs/localhost-key.pem" ]; then
    echo "🔒 Generating SSL certificates..."
    mkdir -p certs
    mkcert -cert-file certs/localhost-cert.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1
    echo "✅ Certificates generated"
    echo ""
fi

# Start the MCP server in the background
echo "📦 Starting MCP server on https://localhost:3000..."
HOST=0.0.0.0 pnpm start &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 3

# Start ngrok tunnel in the background
echo "🌐 Starting ngrok tunnel..."
ngrok http https://localhost:3000 > /dev/null &
NGROK_PID=$!

# Wait for ngrok to be ready
sleep 3

# Get the ngrok public URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Error: Failed to get ngrok URL"
    kill $SERVER_PID $NGROK_PID 2>/dev/null
    exit 1
fi

echo ""
echo "✅ Both services are running!"
echo ""
echo "🌐 Public URL: $NGROK_URL"
echo "🔗 MCP Endpoint: $NGROK_URL/mcp"
echo "🏥 Health Check: $NGROK_URL/health"
echo ""
echo "📋 Add this URL to Claude Desktop connector settings:"
echo "   $NGROK_URL/mcp"
echo ""
echo "🛑 Press Ctrl+C to stop both services"
echo ""

# Handle cleanup on script termination
trap "echo ''; echo '🛑 Stopping services...'; kill $SERVER_PID $NGROK_PID 2>/dev/null; exit" INT TERM

# Keep script running
wait
