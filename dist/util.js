export function random(len) {
    let option = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let ans = "";
    for (let i = 0; i < len; i++) {
        ans += option[Math.floor(Math.random() * option.length)];
    }
    return ans;
}
//# sourceMappingURL=util.js.map