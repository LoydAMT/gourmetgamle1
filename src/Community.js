import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth, getUserProfile } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import './Community.css';

const defaultProfilePicture = 'https://www.kindpng.com/picc/m/451-4517876_default-profile-hd-png-download.png';

function Community() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'posts'), (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    });

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userProfile = await getUserProfile(user.uid);
        if (userProfile) {
          setCurrentUser({
            uid: user.uid,
            name: userProfile.name || user.email,
            profilePicture: userProfile.profilePicture || defaultProfilePicture,
          });
        } else {
          setCurrentUser({
            uid: user.uid,
            name: user.email,
            profilePicture: defaultProfilePicture,
          });
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubscribe();
      authUnsubscribe();
    };
  }, []);

  const handleAddPost = async () => {
    if (newPost.trim() && currentUser) {
      await addDoc(collection(db, 'posts'), {
        content: newPost,
        comments: [],
        likes: [],
        userName: currentUser.name,
        userProfilePicture: currentUser.profilePicture,
      });
      setNewPost('');
    }
  };

  const handleAddComment = async (postId, comment) => {
    if (comment.trim() && currentUser) {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      if (postDoc.exists()) {
        const postData = postDoc.data();
        const newComment = { content: comment, userName: currentUser.name, userProfilePicture: currentUser.profilePicture };
        await updateDoc(postRef, { comments: [...postData.comments, newComment] });
      } else {
        console.error('Post does not exist!');
      }
    }
  };

  const handleLike = async (postId) => {
    if (currentUser) {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      if (postDoc.exists()) {
        const postData = postDoc.data();
        const likes = postData.likes || [];
        if (likes.includes(currentUser.uid)) {
          // Remove like
          await updateDoc(postRef, { likes: likes.filter(uid => uid !== currentUser.uid) });
        } else {
          // Add like
          await updateDoc(postRef, { likes: [...likes, currentUser.uid] });
        }
      }
    }
  };

  return (
    <div className="community-container">
      <h1>Community</h1>
      {currentUser && (
        <div className="new-post-container">
          <img src={currentUser.profilePicture} alt="Profile" className="profile-picture" />
          <input
            type="text"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Write a new post..."
            className="new-post-input"
          />
          <button onClick={handleAddPost} className="new-post-button">Add Post</button>
        </div>
      )}
      <div className="posts-container">
        {posts.map(post => (
          <div key={post.id} className="post-card">
            <div className="post-header">
              <img src={post.userProfilePicture || defaultProfilePicture} alt="Profile" className="profile-picture" />
              <p><strong>{post.userName}</strong>: {post.content}</p>
            </div>
            <div className="likes-comments-container">
              <button onClick={() => handleLike(post.id)} className="like-button">
                {post.likes && post.likes.includes(currentUser?.uid) ? 'Unlike' : 'Like'}
              </button>
              <span>{post.likes ? post.likes.length : 0} Likes</span>
              {post.comments.map((comment, index) => (
                <div key={index} className="comment">
                  <img src={comment.userProfilePicture || defaultProfilePicture} alt="Profile" className="profile-picture" />
                  <p><strong>{comment.userName}</strong>: {comment.content}</p>
                </div>
              ))}
              <AddComment postId={post.id} onAddComment={handleAddComment} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddComment({ postId, onAddComment }) {
  const [comment, setComment] = useState('');

  const handleAddComment = () => {
    onAddComment(postId, comment);
    setComment('');
  };

  return (
    <div className="add-comment-container">
      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write a comment..."
        className="comment-input"
      />
      <button onClick={handleAddComment} className="comment-button">Add Comment</button>
    </div>
  );
}

export default Community;
