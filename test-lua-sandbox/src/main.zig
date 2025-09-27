const std = @import("std");
const zlua = @import("zlua");

const Lua = zlua.Lua;
const print = std.debug.print;

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    const lua = try Lua.init(gpa.allocator());
    defer lua.deinit();

    lua.openBase();
    lua.openIO();

    lua.doFile("../demo-world-spec/distance/init.lua") catch |err| if (err == error.InvalidSyntax) {
        print("{s}\n", .{try lua.toString(-1)});
    };

    lua.doString(
        \\ secrets = io.open(".env", "r")
        \\ print(secrets:read("a"))
    ) catch {
        print("{s}\n", .{try lua.toString(-1)});
    };
}
