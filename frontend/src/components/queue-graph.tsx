import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function QueueGraph() {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Queue Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Graph Placeholder
                </div>
            </CardContent>
        </Card>
    )
}
