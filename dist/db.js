import mongoose, { model, Schema, Document } from 'mongoose';
mongoose.connect('mongodb+srv://raj07:raj1187193@cluster0.3agrntj.mongodb.net/MemoArcX');
const User = new Schema({
    username: { type: String, unique: true },
    password: String,
    email: { type: String, unique: true },
});
const ContentSchema = new Schema({
    title: String,
    link: String,
    tags: [{ type: mongoose.Types.ObjectId, ref: 'Tags' }],
    userId: { type: mongoose.Types.ObjectId, ref: 'user' }
});
const LinkSchema = new Schema({
    hash: String,
    userId: { type: mongoose.Types.ObjectId, ref: 'user', unique: true },
});
export const UserModel = mongoose.model('user', User);
export const ContentModel = mongoose.model('content', ContentSchema);
export const LinkModel = mongoose.model('link', LinkSchema);
//# sourceMappingURL=db.js.map