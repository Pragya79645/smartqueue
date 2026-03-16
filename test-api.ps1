# Test AI Engine API Endpoints using PowerShell

Write-Host "`n==================================================`n" -ForegroundColor Cyan
Write-Host "Testing /health endpoint" -ForegroundColor Yellow
Write-Host "==================================================`n" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8001/health" -Method Get
    Write-Host "SUCCESS!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host "`n==================================================`n" -ForegroundColor Cyan
Write-Host "Testing /predict endpoint" -ForegroundColor Yellow
Write-Host "==================================================`n" -ForegroundColor Cyan

$predictBody = @{
    data = @(5, 6, 7, 8, 10, 12, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 
             3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 
             23, 24, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8)
    minutes_ahead = 15
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8001/predict" -Method Post -Body $predictBody -ContentType "application/json"
    Write-Host "SUCCESS!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host "`n==================================================`n" -ForegroundColor Cyan
Write-Host "Testing /optimize endpoint" -ForegroundColor Yellow
Write-Host "==================================================`n" -ForegroundColor Cyan

$optimizeBody = @{
    current_queue_load = @{
        registration = 10
        billing = 5
        consultation = 8
    }
    predicted_queue_load = @{
        registration = 15
        billing = 8
        consultation = 12
    }
    staff = @(
        @{
            id = 1
            name = "Alice"
            skill_level = "advanced"
            skills = @("registration", "billing")
            available_slots = @(0, 1, 2, 3, 4, 5, 6, 7)
            max_hours = 8.0
            hourly_rate = 20.0
        },
        @{
            id = 2
            name = "Bob"
            skill_level = "intermediate"
            skills = @("consultation", "registration")
            available_slots = @(0, 1, 2, 3, 4)
            max_hours = 5.0
            hourly_rate = 18.0
        }
    )
    counters = @(
        @{
            id = 1
            counter_type = "registration"
            max_capacity = 2
            priority = 1
        },
        @{
            id = 2
            counter_type = "billing"
            max_capacity = 2
            priority = 2
        },
        @{
            id = 3
            counter_type = "consultation"
            max_capacity = 1
            priority = 1
        }
    )
    time_slots = @(0, 1, 2, 3, 4, 5, 6, 7)
    budget = 5000.0
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8001/optimize" -Method Post -Body $optimizeBody -ContentType "application/json"
    Write-Host "SUCCESS!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host "`n==================================================`n" -ForegroundColor Cyan
Write-Host "Tests completed!" -ForegroundColor Green
Write-Host "==================================================`n" -ForegroundColor Cyan
